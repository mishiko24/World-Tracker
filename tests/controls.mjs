// Drives the real map controls in a headless browser and checks canvas pixels.
// Run: npm run build && npm run test:controls
// Starts its own `vite preview` server on port 4173 (set URL to test something else instead).
// Env: CHROME = browser executable (default /usr/bin/google-chrome), MOCK_TILES = folder of mock tile PNGs 0.png..8.png.

import { spawn } from "node:child_process";
import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:4173/";
let server = null;
if (process.env.URL === undefined) {
  server = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    const up = await fetch(URL).then(() => true, () => false);
    if (up) break;
    await new Promise((r) => setTimeout(r, 100));
  }
}
const W = 1600;
const H = 900;

// Same projection math as src/map/geo.ts, so the test knows where countries are at the start view.
const WORLD_WIDTH = 1000;
const mercY = (lat) => WORLD_WIDTH / 2 - (WORLD_WIDTH / (2 * Math.PI)) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercX = (lon) => WORLD_WIDTH / 2 + (WORLD_WIDTH / 360) * lon;
const WORLD_TOP = mercY(84);
const WORLD_BOTTOM = mercY(-60);
const SCALE = H / (WORLD_BOTTOM - WORLD_TOP);
const startScreen = (lon, lat) => [
  (mercX(lon) - WORLD_WIDTH / 2) * SCALE + W / 2,
  (mercY(lat) - (WORLD_TOP + WORLD_BOTTOM) / 2) * SCALE + H / 2,
];

// Dark map preset colors (src/settings.ts).
const COLORS = {
  default: [0x26, 0x2a, 0x30],
  highlighted: [0xc9, 0x77, 0x2a],
  selected: [0xe3, 0x26, 0x1b],
  ocean: [0x0f, 0x14, 0x19],
};
const LIGHT = { default: [0xf4, 0xf2, 0xee], ocean: [0xc9, 0xd7, 0xe3] };
// Mock satellite tiles: one flat color per zoom level, made by the test setup (see MOCK_TILES).
const MOCK_TILES = process.env.MOCK_TILES ?? "tests/mock-tiles";
const tileColor = (z) => [z * 28, 120, 255 - z * 28];

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.route("https://static.cloudflareinsights.com/**", (route) => route.abort()); // test runs aren't visits
page.on("pageerror", (e) => check("no page errors", false, e.message));
const tileRequests = [];
await page.route(/gibs\.earthdata\.nasa\.gov/, (route) => {
  const [z, y, x] = route.request().url().match(/(\d+)\/(\d+)\/(\d+)\.jpeg$/).slice(1).map(Number);
  tileRequests.push({ z, x, y });
  route.fulfill({ path: `${MOCK_TILES}/${z}.png`, contentType: "image/png", headers: { "Access-Control-Allow-Origin": "*" } });
});
await page.goto(URL);
await page.waitForSelector("canvas");
await page.waitForTimeout(300);

// Hide the settings panel so it doesn't cover the map during input tests.
await page.click('button[title="Hide settings"]');

async function pixel(x, y) {
  await page.waitForTimeout(50); // let a frame draw
  return page.evaluate(
    ([x, y]) => {
      const c = document.querySelector("canvas");
      const dpr = window.devicePixelRatio;
      return Array.from(c.getContext("2d").getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data.slice(0, 3));
    },
    [x, y],
  );
}
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 12);
const panelTitle = async () => (await page.$("aside.panel-right h2")) && page.textContent("aside.panel-right h2");

async function middleDrag(dx, dy, steps = 10) {
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.down({ button: "middle" });
  for (let i = 1; i <= steps; i++) await page.mouse.move(W / 2 + (dx * i) / steps, H / 2 + (dy * i) / steps);
  await page.mouse.up({ button: "middle" });
}

const [spainX, spainY] = startScreen(-3.7, 40.0);
const [oceanX, oceanY] = startScreen(-40, 30);

check("Spain default color at start", near(await pixel(spainX, spainY), COLORS.default));
check("ocean color at start", near(await pixel(oceanX, oceanY), COLORS.ocean));

await page.mouse.move(spainX, spainY);
check("hover highlights Spain", near(await pixel(spainX, spainY), COLORS.highlighted));

await page.mouse.click(spainX, spainY);
check("click selects Spain (panel)", (await panelTitle()) === "Spain", String(await panelTitle()));
check("Spain drawn selected", near(await pixel(spainX, spainY), COLORS.selected));

const headers = await page.$$eval("aside.panel-right .collapsible-header", (els) => els.map((e) => e.textContent));
check("6 sections in info panel", headers.length === 6, headers.join(", "));
check("sections collapsed by default", (await page.$$("aside.panel-right .collapsible-body")).length === 0);
await page.click("aside.panel-right .collapsible-header >> text=Government");
check("Government expands on click", (await page.$$("aside.panel-right .collapsible-body")).length === 1);

// Left drag on the ocean is not a click: selection stays.
await page.mouse.move(oceanX, oceanY);
await page.mouse.down();
await page.mouse.move(oceanX + 40, oceanY + 10, { steps: 5 });
await page.mouse.up();
check("left drag does not deselect", (await panelTitle()) === "Spain");

await page.mouse.click(oceanX, oceanY);
check("click on ocean deselects", (await panelTitle()) === null);

await page.mouse.click(spainX, spainY);
await page.keyboard.press("Escape");
check("Esc deselects", (await panelTitle()) === null);

// Microstate dot: Vatican sits inside Italy and is far too small to click as a shape at zoom 1.
const [vatX, vatY] = startScreen(12.45, 41.9);
await page.mouse.click(vatX, vatY);
check("Vatican dot is clickable", (await panelTitle()) === "Vatican", String(await panelTitle()));

// Select Spain, then pan with the right mouse button.
await page.mouse.click(spainX, spainY);
await middleDrag(300, 0);
check("middle-button pan moves map (Spain +300px)", near(await pixel(spainX + 300, spainY), COLORS.selected));
check("middle-button pan kept selection", (await panelTitle()) === "Spain");

// Vertical pan at min zoom is clamped: nothing moves.
await middleDrag(0, 250);
check("vertical pan clamped at zoom 1", near(await pixel(spainX + 300, spainY), COLORS.selected));

// Horizontal wrap: pan exactly one world width; Spain must be back where it was.
const worldWidthPx = WORLD_WIDTH * SCALE;
await middleDrag(-worldWidthPx, 0, 30);
check("horizontal wrap after one world width", near(await pixel(spainX + 300, spainY), COLORS.selected));
await middleDrag(-1500, 0, 30);
await middleDrag(-1500, 0, 30);
const landFraction = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let land = 0;
  for (let i = 0; i < d.length; i += 400) if (d[i] === 0x26 && d[i + 1] === 0x2a) land++;
  return land / (d.length / 400);
});
check("land still drawn after long pan", landFraction > 0.15, `land fraction ${landFraction.toFixed(2)}`);

// Zoom: reload to reset camera, zoom on Spain, Spain must stay under the cursor.
await page.goto(URL);
await page.waitForSelector("canvas");
await page.waitForTimeout(300);
if (await page.$('button[title="Hide settings"]')) await page.click('button[title="Hide settings"]');
const [eastX, eastY] = [spainX, spainY - 25]; // Bay of Biscay at zoom 1, inland Spain after zooming on Spain
check("point north of Spain is sea at zoom 1", near(await pixel(eastX, eastY), COLORS.ocean));
await page.mouse.click(spainX, spainY);
for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100);
await page.waitForTimeout(800);
check("zoom keeps Spain under cursor", near(await pixel(spainX, spainY), COLORS.selected));
check("zoomed in: Spain now covers the point north of it", near(await pixel(eastX, eastY), COLORS.selected));
await page.screenshot({ path: "/tmp/wt-zoomed.png" });

await middleDrag(0, -200);
check("vertical pan works when zoomed", near(await pixel(spainX, spainY - 200), COLORS.selected));

for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 100);
await page.waitForTimeout(1000);
await middleDrag(0, 1000); // push back to vertical center limit
const backAtMin = near(await pixel(eastX, eastY), COLORS.ocean) || near(await pixel(eastX, eastY - 200), COLORS.ocean);
check("zoom out clamps at min zoom (Spain small again)", backAtMin);

// Safari trackpad pinch arrives as gesturestart/gesturechange (scale = total pinch). Simulated: Chrome has no such events.
const safariPinch = (scale) =>
  page.evaluate(
    ([x, y, scale]) => {
      const canvas = document.querySelector("canvas");
      const fire = (type, s) => canvas.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { scale: s, clientX: x, clientY: y }));
      fire("gesturestart", 1);
      fire("gesturechange", (1 + scale) / 2);
      fire("gesturechange", scale);
      fire("gestureend", scale);
    },
    [spainX, spainY, scale],
  );
await safariPinch(4);
await page.waitForTimeout(300);
check("Safari pinch zooms around the pinch point", near(await pixel(spainX, spainY), COLORS.selected) && near(await pixel(eastX, eastY), COLORS.selected));
await safariPinch(0.1);
await page.waitForTimeout(300);
check("Safari pinch out zooms back out", near(await pixel(eastX, eastY), COLORS.ocean));
await page.keyboard.press("Escape");

// Settings: change selected fill color, check it applies and persists.
await page.click('button[title="Show settings"]');
await page.click("aside.panel-left .collapsible-header >> text=Selected country");
await page.locator('aside.panel-left input[type="color"]').first().fill("#00ff00");
await page.mouse.click(spainX + 400, spainY); // somewhere right of the panel; click Spain needs panel out of the way
await page.click('button[title="Hide settings"]');
await page.mouse.click(spainX, spainY);
check("selected fill color setting applies", near(await pixel(spainX, spainY), [0, 255, 0]));
await page.goto(URL);
await page.waitForSelector("canvas");
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("worldTracker.settings.v2")).styles.dark.selected.fillColor);
check("settings persist across reload", saved === "#00ff00", saved);

// ---------- comparison mode ----------
// Fresh start view (camera back at zoom 1, nothing selected, default colors).
await page.evaluate(() => localStorage.clear());
await page.goto(URL);
await page.waitForSelector("canvas");
await page.waitForTimeout(300);
if (await page.$('button[title="Hide settings"]')) await page.click('button[title="Hide settings"]');
const COMPARED = [0x2f, 0x7d, 0xe1];
const [franceX, franceY] = startScreen(2.5, 46.5);

await page.mouse.click(franceX, franceY, { button: "right" });
check("right click with nothing selected does nothing", (await page.$(".compare-header")) === null && (await panelTitle()) === null);

// A right drag is not a click and must not pan any more.
await page.mouse.click(spainX, spainY);
await page.mouse.move(franceX, franceY);
await page.mouse.down({ button: "right" });
await page.mouse.move(franceX + 60, franceY, { steps: 5 });
await page.mouse.up({ button: "right" });
check("right drag neither pans nor compares", (await page.$(".compare-header")) === null && near(await pixel(spainX, spainY), COLORS.selected));

await page.mouse.click(franceX, franceY, { button: "right" });
await page.waitForSelector(".compare-header");
check("right click compares: header shows vs France", (await page.textContent(".compare-header")).includes("vs France"));
check("panel still shows Spain", (await panelTitle()) === "Spain");
check("compared country drawn in compared color", near(await pixel(franceX, franceY), COMPARED));
check("selected country keeps its color", near(await pixel(spainX, spainY), COLORS.selected));

await page.click("aside.panel-right .collapsible-header >> text=Population");
await page.click("aside.panel-right .collapsible-header >> text=Economy");
await page.waitForTimeout(200);
// Comparison rows: label | Spain's bar + value, France's bar + value, how much more/less France has.
// The better value has class "win".
const compareRow = async (label) =>
  page.evaluate((label) => {
    const row = [...document.querySelectorAll("aside.panel-right .fact.compared-number")].find(
      (r) => r.querySelector(".fact-label").textContent === label,
    );
    if (!row) return null;
    const [a, b] = row.querySelectorAll(".compared-value");
    const bars = [...row.querySelectorAll(".compare-bar span")].map((el) => parseFloat(el.style.width));
    return { aWins: a.classList.contains("win"), bWins: b.classList.contains("win"), diff: row.querySelector(".compared-diff")?.textContent, bars };
  }, label);
const keyA = await page.textContent(".panel-title .keyed.a");
const keyB = await page.textContent(".panel-title .keyed.b");
check("header is the color key: Spain (A) and France (B) underlined", keyA === "Spain" && keyB === "France", `${keyA} / ${keyB}`);
const popRow = await compareRow("Population");
check("France has more people: France's value is the winner", popRow?.bWins === true && popRow.aWins === false, JSON.stringify(popRow));
check("larger value fills its bar, smaller is shorter", popRow?.bars[1] === 100 && popRow.bars[0] < 100, JSON.stringify(popRow?.bars));
const spainData = await (await fetch(`${URL}data/countries/ESP.json`)).json();
const franceData = await (await fetch(`${URL}data/countries/FRA.json`)).json();
const expectedPct = Math.round(((franceData.population.total.value - spainData.population.total.value) / spainData.population.total.value) * 100);
check("population: how much more France has", popRow?.diff === `${expectedPct}% more`, `${popRow?.diff} expected ${expectedPct}% more`);
const infRow = await compareRow("Inflation");
const franceLowerInflation = franceData.economy.inflation.value < spainData.economy.inflation.value;
check(
  "inflation: lower is better and shown in pp",
  infRow !== null && infRow.diff.includes("pp") && infRow.bWins === franceLowerInflation && infRow.aWins === !franceLowerInflation,
  JSON.stringify(infRow),
);
const medianRow = await compareRow("Median age");
check("median age has no winner, difference in years", medianRow !== null && !medianRow.aWins && !medianRow.bWins && /years (more|less)$/.test(medianRow.diff), JSON.stringify(medianRow));
const gdpRow = await compareRow("GDP");
check("big differences read as ×", /^\d|same/.test(gdpRow?.diff ?? "") , JSON.stringify(gdpRow));
await page.click("aside.panel-right .collapsible-header >> text=Government");
const govLines = await page.$$eval("aside.panel-right .fact.compared-text", (rows) => rows[0].querySelectorAll(".compared-line").length);
check("government rows show both countries", govLines === 2);
const flagCheck = await page.evaluate(() => {
  const loaded = (img) => img.complete && img.naturalWidth > 0;
  const headerFlags = [...document.querySelectorAll("aside.panel-right .panel-title img.flag")];
  const govFlag = getComputedStyle(document.querySelector(".compared-text .flag-b")).backgroundImage;
  return { header: headerFlags.length, headerLoaded: headerFlags.every(loaded), gov: govFlag };
});
check("header shows both flags", flagCheck.header === 2 && flagCheck.headerLoaded, JSON.stringify(flagCheck));
check("comparison rows use B's flag", flagCheck.gov.endsWith("/flags/FRA.png\")"), flagCheck.gov);
const metaTexts = await page.$$eval("aside.panel-right .fact-meta", (els) => els.map((e) => e.textContent));
check("meta lines carry no sources", metaTexts.every((t) => !/World Bank|IMF|UN|EIA|USGS|FAO|Ember/.test(t)), metaTexts.join(" | "));
const tooltip = await page.$eval("aside.panel-right .compared-value", (el) => el.title);
check("year and source available as tooltip", /20\d\d · /.test(tooltip), tooltip);

await page.mouse.click(oceanX, oceanY, { button: "right" });
await page.waitForTimeout(100);
check("right click on ocean ends comparison", (await page.$(".compare-header")) === null && (await panelTitle()) === "Spain");

await page.mouse.click(franceX, franceY, { button: "right" });
await page.waitForSelector(".compare-header");
await page.click('.compare-header button[title="End comparison"]');
check("✕ ends comparison", (await page.$(".compare-header")) === null);

await page.mouse.click(franceX, franceY, { button: "right" });
await page.waitForSelector(".compare-header");
await page.mouse.click(franceX, franceY);
await page.waitForTimeout(100);
check("left click selects a new country and ends comparison", (await panelTitle()) === "France" && (await page.$(".compare-header")) === null);
await page.keyboard.press("Escape");

// ---------- map types ----------
await page.evaluate(() => localStorage.clear());
await page.goto(URL);
await page.waitForSelector("canvas");
await page.waitForTimeout(300);
const mapTypeSelect = "aside.panel-left select.map-type-select";
const options = await page.$$eval(`${mapTypeSelect} option`, (els) => els.map((e) => e.value));
check("map type dropdown has dark/light/satellite", options.join() === "dark,light,satellite", options.join());
await page.click('button[title="Hide settings"]');
const [atlX, atlY] = startScreen(-40, 30);

await page.click('button[title="Show settings"]');
await page.selectOption(mapTypeSelect, "light");
await page.click('button[title="Hide settings"]');
check("light map: ocean color", near(await pixel(atlX, atlY), LIGHT.ocean));
check("light map: land color", near(await pixel(spainX, spainY), LIGHT.default));

tileRequests.length = 0;
await page.click('button[title="Show settings"]');
await page.selectOption(mapTypeSelect, "satellite");
await page.click('button[title="Hide settings"]');
await page.waitForTimeout(400);
check("satellite: attribution shown", (await page.textContent(".attribution")).includes("NASA"));
// 1600x900 at zoom 1: world is ~1320 px wide -> log2(1320/256) = 2.4 -> tile level 2.
check("satellite: ocean shows level-2 imagery", near(await pixel(atlX, atlY), tileColor(2)), String(await pixel(atlX, atlY)));
check("satellite: countries see-through by default", near(await pixel(spainX, spainY), tileColor(2)));
check("satellite: tile x/y always inside the level", tileRequests.every((t) => t.x >= 0 && t.x < 2 ** t.z && t.y >= 0 && t.y < 2 ** t.z));
const levels = [...new Set(tileRequests.map((t) => t.z))].sort().join();
check("satellite: only base levels requested at zoom 1", levels === "0,1,2", levels);

await page.mouse.click(spainX, spainY);
const tinted = await pixel(spainX, spainY);
check("satellite: selected country tinted", !near(tinted, tileColor(2)), String(tinted));

await page.mouse.move(atlX, atlY);
for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -100);
await page.waitForTimeout(1200);
const zoomedLevel = Math.max(...tileRequests.map((t) => t.z));
check("satellite: zooming in loads deeper tiles", zoomedLevel >= 6, `max level ${zoomedLevel}`);
check("satellite: deepest level is capped at 8", zoomedLevel <= 8);
check("satellite: zoomed ocean shows deep tiles", near(await pixel(atlX, atlY), tileColor(zoomedLevel)), String(await pixel(atlX, atlY)));
await middleDrag(-3000, 0, 40);
await page.waitForTimeout(600);
check("satellite: wrap keeps tile coords valid", tileRequests.every((t) => t.x >= 0 && t.x < 2 ** t.z));
const perLevel = {}; for (const t of tileRequests) perLevel[t.z] = (perLevel[t.z] ?? 0) + 1;
check("satellite: request count sane", tileRequests.length < 400, `${tileRequests.length} ${JSON.stringify(perLevel)}`);
await page.screenshot({ path: "/tmp/wt-satellite.png" });

const darkSelected = await page.evaluate(() => JSON.parse(localStorage.getItem("worldTracker.settings.v2")).mapType);
check("map type persists", darkSelected === "satellite");

// ---------- list view ----------
await page.evaluate(() => localStorage.clear());
await page.goto(URL);
await page.waitForSelector("canvas");
await page.waitForTimeout(300);
await page.check("aside.panel-left .list-view-toggle input");
await page.waitForSelector(".country-list tbody tr");
check("list view hides the map", await page.$eval("canvas", (c) => getComputedStyle(c).visibility === "hidden"));
const headerNames = await page.$$eval(".country-list th", (els) => els.map((e) => e.textContent.replace(/[▲▼]/g, "").trim()));
check(
  "list view columns",
  headerNames.join("|") ===
    "Name|Power Level|Population|Births per woman|Life expectancy|Median age|Density (per km²)|GDP|GDP per capita|GDP per capita (PPP)|Real growth|Inflation|Central gov. debt|Central gov. debt (% GDP)|Political stability|Electricity generated (TWh)|Access to electricity",
  headerNames.join("|"),
);
const PPP_COLUMN = headerNames.indexOf("GDP per capita (PPP)");
const firstNames = async () => page.$$eval(".country-list tbody tr td:first-child", (els) => els.slice(0, 3).map((e) => e.textContent));
const columnValues = async (index) =>
  page.$$eval(".country-list tbody tr", (rows, i) => rows.map((r) => r.children[i].textContent), index);
check("default sort: Power Level, highest first", (await firstNames())[0] === "China", (await firstNames()).join(", "));
await page.click(".country-list th >> text=GDP per capita (PPP)");
const pppDesc = (await columnValues(PPP_COLUMN)).filter((v) => v !== "—").map((v) => Number(v.replace(/[$,]/g, "")));
check("click header sorts highest first", pppDesc.every((v, i) => i === 0 || pppDesc[i - 1] >= v), pppDesc.slice(0, 3).join(", "));
await page.click(".country-list th >> text=GDP per capita (PPP)");
const pppAll = await columnValues(PPP_COLUMN);
const pppAsc = pppAll.filter((v) => v !== "—").map((v) => Number(v.replace(/[$,]/g, "")));
check("second click reverses (lowest first)", pppAsc.every((v, i) => i === 0 || pppAsc[i - 1] <= v), pppAsc.slice(0, 3).join(", "));
check("missing values stay at the bottom", pppAll.indexOf("—") === pppAsc.length && pppAll.slice(pppAsc.length).every((v) => v === "—"));
await page.click(".country-list th >> text=Name");
check("name sorts A→Z", (await firstNames())[0] < (await firstNames())[1], (await firstNames()).join(", "));
await page.click(".country-list tbody tr >> text=Georgia");
check("row click opens info panel", (await panelTitle()) === "Georgia", String(await panelTitle()));
check("selected row highlighted", (await page.$eval(".country-list tr.selected td", (td) => td.textContent)) === "Georgia");
await page.click(".country-list tbody tr >> text=Armenia", { button: "right" });
await page.waitForSelector(".compare-header");
check("right click on a row compares", (await page.textContent(".compare-header")).includes("vs Armenia"));
check("compared row highlighted", (await page.$eval(".country-list tr.compared td", (td) => td.textContent)) === "Armenia");
// The pinned name column must hide cells scrolled under it, also on the selected and hovered rows.
const nameCellsOpaque = await page.$$eval(".country-list tbody tr.selected td.name-column, .country-list tbody tr:hover td.name-column", (tds) =>
  tds.every((td) => !getComputedStyle(td).backgroundColor.startsWith("rgba")),
);
check("pinned name cells have opaque backgrounds", nameCellsOpaque);
await page.uncheck("aside.panel-left .list-view-toggle input");
check("toggle back shows the map", await page.$eval("canvas", (c) => getComputedStyle(c).visibility === "visible"));
check("selection survives toggling", (await panelTitle()) === "Georgia");
await page.evaluate(() => localStorage.clear());

// ---------- Power Level ----------
await page.evaluate(() => localStorage.clear());
await page.goto(`${URL}?c=ESP`);
await page.waitForSelector(".power-card .power-score");
const scoreText = await page.textContent(".power-card .power-score");
const spainLevel = (await (await fetch(`${URL}data/countries/ESP.json`)).json()).powerLevel;
check("Power Level card shows score", scoreText.startsWith(spainLevel.score.toFixed(1)), scoreText);
check("Power Level card shows rank", (await page.textContent(".power-rank")).includes(`#${spainLevel.rank}`));
check("six pillar bars", (await page.$$(".power-card .pillar")).length === 6);
await page.goto(`${URL}?c=ESP&vs=FRA`);
await page.waitForSelector(".power-card.comparing");
check(
  "Power Level compares in compare mode: two scores, two bars per pillar",
  (await page.$$(".power-card.comparing .pillar-bar")).length === 12 && (await page.$$(".power-side")).length === 2,
);
await page.goto(URL);
await page.waitForSelector("canvas");
await page.waitForTimeout(300);
if (await page.$('button[title="Hide settings"]')) await page.click('button[title="Hide settings"]');
const chinaPoint = startScreen(103, 35);
const beforeHeat = await pixel(...chinaPoint);
await page.click('button[title="Show settings"]');
await page.selectOption("aside.panel-left select.color-by-select", "powerLevel");
await page.click('button[title="Hide settings"]');
await page.waitForTimeout(300);
const afterHeat = await pixel(...chinaPoint);
check("heat map recolors countries", !near(beforeHeat, afterHeat), `${beforeHeat} -> ${afterHeat}`);
check("heat map legend shown", (await page.$(".heat-legend")) !== null);
await page.evaluate(() => localStorage.clear());

// ---------- shareable links + search ----------
await page.evaluate(() => localStorage.clear());
await page.goto(`${URL}?c=JPN&vs=KOR`);
await page.waitForSelector(".compare-header");
check("link opens selected country", (await panelTitle()) === "Japan", String(await panelTitle()));
check("link opens comparison", (await page.textContent(".compare-header")).includes("South Korea"));
await page.waitForTimeout(300);
check("link focuses camera on the country (center is Japan)", near(await pixel(W / 2, H / 2), COLORS.selected), String(await pixel(W / 2, H / 2)));

// ---------- share card ----------
await page.click(".share-button");
await page.waitForSelector(".share-preview img");
const card = await page.$eval(".share-preview img", (img) => img.decode().then(() => [img.naturalWidth, img.naturalHeight]));
check("share card is 1200x630", card[0] === 1200 && card[1] === 630, card.join("x"));
check("share card file named after both countries", (await page.getAttribute(".share-actions a[download]", "download")) === "world-tracker-jpn-vs-kor.png");
await page.waitForFunction(() => !document.querySelector(".share-link").textContent.includes("…"));
check("share link is the comparison page", (await page.textContent(".share-link")).endsWith("/compare/japan-vs-south-korea/"), await page.textContent(".share-link"));
await page.click(".embed-toggle");
const embed = await page.inputValue(".embed-code");
check(
  "embed code: iframe of the comparison plus a plain link to its page",
  embed.includes("embed.html?c=JPN&vs=KOR") && embed.includes('href="https://mishiko24.github.io/World-Tracker/compare/japan-vs-south-korea/"'),
  embed,
);
await page.click(".embed-themes button >> text=Light");
check("embed code: light theme", (await page.inputValue(".embed-code")).includes("&theme=light"));
await page.keyboard.press("Escape");
check("Esc closes the share dialog but keeps the selection", (await page.$(".share-dialog")) === null && (await panelTitle()) === "Japan");
await page.goto(URL);
await page.waitForSelector(".search-box input");
await page.fill(".search-box input", "germ");
await page.keyboard.press("Enter");
await page.waitForSelector("aside.panel-right h2");
check("search + Enter selects country", (await panelTitle()) === "Germany", String(await panelTitle()));
check("URL follows selection", new globalThis.URL(page.url()).searchParams.get("c") === "DEU", page.url());
await page.fill(".search-box input", "usa");
const firstResult = await page.textContent(".search-results li");
check("search matches ISO codes", firstResult === "United States", firstResult);
await page.keyboard.press("Escape");
check("Esc in search keeps the selection", (await panelTitle()) === "Germany");
await page.check("aside.panel-left .list-view-toggle input");
await page.waitForSelector(".country-list tbody tr");
await page.click(".country-list th >> text=Inflation");
const listUrl = new globalThis.URL(page.url()).searchParams;
check("URL has list view + sort", listUrl.get("view") === "list" && listUrl.get("sort") === "inflation.desc", page.url());
await page.goto(`${URL}?view=list&sort=gdp.asc`);
await page.waitForSelector(".country-list tbody tr");
const gdpArrow = await page.textContent(".country-list th >> text=GDP ▲");
check("link restores list view and sort", gdpArrow !== null);
await page.evaluate(() => localStorage.clear());

// Frame cost while panning.
await page.evaluate(() => localStorage.clear());
await page.goto(URL);
await page.waitForSelector("canvas");
await page.waitForTimeout(300);
await page.click('button[title="Hide settings"]');
await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const tick = (t) => {
    window.__frames.push(t - last);
    last = t;
    if (window.__frames.length < 120) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await middleDrag(-1200, 0, 120);
const frames = await page.evaluate(() => window.__frames.slice(5));
frames.sort((a, b) => a - b);
console.log(`INFO  pan frame time median ${frames[frames.length >> 1].toFixed(1)} ms, p95 ${frames[Math.floor(frames.length * 0.95)].toFixed(1)} ms (headless, software rendering)`);

await page.screenshot({ path: "/tmp/wt-start.png" });
// Share link: country page for one country; the map URL for a pair without a page.
await page.goto(`${URL}?c=GEO`);
await page.waitForSelector(".share-button:not([disabled])");
await page.click(".share-button");
await page.waitForFunction(() => !document.querySelector(".share-link").textContent.includes("…"));
check("share link for one country is its page", (await page.textContent(".share-link")).endsWith("/country/georgia/"));
await page.goto(`${URL}?c=TUV&vs=ISL`);
await page.waitForSelector(".share-button:not([disabled])");
await page.click(".share-button");
await page.waitForFunction(() => !document.querySelector(".share-link").textContent.includes("…"));
check("pair without a page shares the map link", (await page.textContent(".share-link")).endsWith("?c=TUV&vs=ISL"), await page.textContent(".share-link"));

// ---------- trend charts ----------
await page.goto(`${URL}?c=ESP`);
await page.waitForSelector(".power-card");
await page.click("aside.panel-right .collapsible-header >> text=Population");
check("rows with history get a trend toggle", (await page.$$("aside.panel-right .trend-toggle")).length === 3);
await page.click("aside.panel-right .trend-toggle >> text=Population");
check("trend chart opens with one line", (await page.$$("aside.panel-right .trend-line")).length === 1);
const spainTrend = (await (await fetch(`${URL}data/countries/ESP.json`)).json()).trends.population;
const readout = await page.textContent(".trend-readout");
check("readout shows the latest year by default", readout.startsWith(String(spainTrend[spainTrend.length - 1][0])), readout);
await page.goto(`${URL}?c=ESP&vs=FRA`);
await page.waitForSelector(".power-card.comparing");
await page.click("aside.panel-right .collapsible-header >> text=Economy");
await page.click("aside.panel-right .trend-toggle >> text=GDP per capita (PPP)");
check("comparison trend: both countries' lines", (await page.$$("aside.panel-right .trend-line.a, aside.panel-right .trend-line.b")).length === 2);
const chart = await (await page.$(".trend-svg")).boundingBox();
await page.mouse.move(chart.x + chart.width * 0.2, chart.y + chart.height / 2);
const hovered = await page.textContent(".trend-year");
check("pointing at the chart reads out an earlier year", Number(hovered) < spainTrend[spainTrend.length - 1][0], hovered);

// Drag across the chart to measure (Google Finance style).
const chartBox = await (await page.$(".trend-svg")).boundingBox();
await page.mouse.move(chartBox.x + chartBox.width * 0.25, chartBox.y + chartBox.height / 2);
await page.mouse.down();
for (let i = 1; i <= 6; i++) await page.mouse.move(chartBox.x + chartBox.width * (0.25 + i * 0.1), chartBox.y + chartBox.height / 2);
await page.mouse.up();
const measured = await page.textContent(".trend-readout.measuring");
check("drag measures a change for both countries (two ▲/▼ amounts)", (measured.match(/[▲▼]/g) ?? []).length === 2 && measured.includes("→"), measured);
check("measured span is shaded with end dots", (await page.$(".trend-span")) !== null && (await page.$$(".trend-end")).length === 4);
await page.mouse.click(chartBox.x + chartBox.width * 0.5, chartBox.y + chartBox.height / 2);
check("a click clears the measurement", (await page.$(".trend-readout.measuring")) === null);

// ---------- Map | Play switch ----------
await page.goto(`${URL}?c=FRA&vs=DEU`);
await page.waitForSelector(".power-card");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector(".mode-switch .daily-dot");
check("Play shows a dot while today's daily isn't done", true);
const switchBox = () => page.$eval(".mode-switch", (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)].join(","); });
const switchOnMap = await switchBox();
await page.click(".mode-switch >> text=Play");
await page.waitForSelector(".mode-tabs");
check("Play opens the games page", page.url().includes("play.html"));
check("the switch stays in the same spot on both pages", (await switchBox()) === switchOnMap, `${switchOnMap} vs ${await switchBox()}`);
await page.click(".mode-switch >> text=Map");
await page.waitForSelector(".power-card");
check("Map returns to the same view", page.url().endsWith("?c=FRA&vs=DEU"), page.url());

// ---------- Higher or Lower (play.html) ----------
const summary = await (await fetch(`${URL}data/summary.json`)).json();
const valueOf = (id, key) => summary.find((s) => s.id === id)[key];
const gameState = () =>
  page.evaluate(() => {
    const [left, right] = [...document.querySelectorAll(".country-card")].map((c) => c.dataset.id);
    return { left, right, metric: document.querySelector(".cards").dataset.metric, streak: document.querySelector(".streak")?.textContent ?? null };
  });
await page.goto(`${URL}play.html?mode=endless`);
await page.evaluate(() => localStorage.clear());
await page.goto(`${URL}play.html?mode=endless`);
await page.waitForSelector(".guess");
let round = await gameState();
const rightAnswer = valueOf(round.right, round.metric) > valueOf(round.left, round.metric) ? "higher" : "lower";
await page.click(`[data-guess="${rightAnswer}"]`);
await page.waitForSelector(".guess", { timeout: 4000 });
const after = await gameState();
check("right answer: streak 1, right country moves left", after.streak === "1" && after.left === round.right, JSON.stringify({ round, after }));
round = after;
const wrongAnswer = valueOf(round.right, round.metric) > valueOf(round.left, round.metric) ? "lower" : "higher";
await page.click(`[data-guess="${wrongAnswer}"]`);
await page.waitForSelector(".game-over", { timeout: 4000 });
check("wrong answer ends the game", (await page.textContent(".final")).includes("1 in a row"));
await page.goto(`${URL}play.html?mode=endless`);
await page.waitForSelector(".scores");
check("best streak is remembered", (await page.textContent(".scores")).replace(/\s+/g, "").includes("Best1"), await page.textContent(".scores"));

// Daily challenge: same questions for everyone today, all 10 answered, result kept.
await page.goto(`${URL}play.html`);
await page.waitForSelector(".guess");
const firstDaily = await gameState();
await page.goto(`${URL}play.html?mode=daily`);
await page.waitForSelector(".guess");
check("daily is the default mode and the same questions on reload", JSON.stringify(await gameState()) === JSON.stringify(firstDaily));
let dailyRight = 0;
for (let i = 0; i < 10; i++) {
  await page.waitForSelector(".guess");
  const r = await gameState();
  const higher = valueOf(r.right, r.metric) > valueOf(r.left, r.metric);
  const answerRight = i % 3 !== 0; // get some wrong on purpose: a wrong answer must not end the daily
  dailyRight += answerRight ? 1 : 0;
  await page.click(`[data-guess="${higher === answerRight ? "higher" : "lower"}"]`);
  await page.waitForTimeout(1400);
}
await page.waitForSelector(".daily-result");
check("daily: all 10 answered, score counts right answers", (await page.textContent(".daily-result h2")) === `${dailyRight}/10`, await page.textContent(".daily-result h2"));
await page.goto(`${URL}play.html?mode=daily`);
await page.waitForSelector(".daily-result");
check("daily: one attempt per day (result shown on return)", (await page.$(".guess")) === null);

// Flag quiz: right answer scores, three wrong answers end it.
await page.goto(`${URL}play.html?mode=flags`);
await page.waitForSelector(".option");
const answerId = await page.getAttribute(".quiz-clue", "data-answer");
await page.click(`.option[data-id="${answerId}"]`);
await page.waitForTimeout(1500);
check("flag quiz: right answer scores", (await page.textContent(".streak")) === "1");
for (let i = 0; i < 3; i++) {
  const answer = await page.getAttribute(".quiz-clue", "data-answer");
  await page.click(`.option:not([data-id="${answer}"]) >> nth=0`);
  await page.waitForTimeout(1500);
}
check("flag quiz: three wrong answers end the game", (await page.$(".game-over")) !== null);
await page.goto(`${URL}play.html?mode=outlines`);
await page.waitForSelector("canvas.quiz-outline");
check("outline quiz draws the shape", await page.$eval("canvas.quiz-outline", (c) => c.width > 0));

// Embed card (embed.html): one country and a comparison render, and link to the right page.
await page.goto(`${URL}embed.html?c=GEO`);
await page.waitForSelector(".embed h1");
check("embed: one country", (await page.textContent(".embed h1")) === "Georgia" && (await page.getAttribute(".embed", "href")).endsWith("/country/georgia/"));
await page.goto(`${URL}embed.html?c=ARM&vs=GEO&theme=light`);
await page.waitForSelector(".bar-row");
check(
  "embed: comparison with bars, light theme, links to the comparison page",
  (await page.$$(".bar-row")).length === 5 &&
    (await page.evaluate(() => document.documentElement.dataset.theme)) === "light" &&
    (await page.getAttribute(".embed", "href")).endsWith("/compare/armenia-vs-georgia/"),
);

// ---------- Sources & method page ----------
await page.goto(`${URL}?c=CHN`);
await page.click(".power-method-link");
await page.waitForSelector(".facts-strip .value");
await page.waitForFunction(() => !document.querySelector(".facts-strip .value").textContent.includes("…"));
const meta = await (await fetch(`${URL}data/meta.json`)).json();
check("Power Level link opens the method section", page.url().endsWith("about.html#power-level"), page.url());
check("about page shows the data date", (await page.textContent(".facts-strip")).includes(String(Number(meta.builtAt.slice(8)))), meta.builtAt);
check("about page lists the six pillar weights", (await page.$$("#power-level + p + table tbody tr")).length === 6);

await browser.close();
server?.kill();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
