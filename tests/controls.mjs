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

async function rightDrag(dx, dy, steps = 10) {
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.down({ button: "right" });
  for (let i = 1; i <= steps; i++) await page.mouse.move(W / 2 + (dx * i) / steps, H / 2 + (dy * i) / steps);
  await page.mouse.up({ button: "right" });
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
await rightDrag(300, 0);
check("RMB pan moves map (Spain +300px)", near(await pixel(spainX + 300, spainY), COLORS.selected));
check("RMB pan kept selection", (await panelTitle()) === "Spain");

// Vertical pan at min zoom is clamped: nothing moves.
await rightDrag(0, 250);
check("vertical pan clamped at zoom 1", near(await pixel(spainX + 300, spainY), COLORS.selected));

// Horizontal wrap: pan exactly one world width; Spain must be back where it was.
const worldWidthPx = WORLD_WIDTH * SCALE;
await rightDrag(-worldWidthPx, 0, 30);
check("horizontal wrap after one world width", near(await pixel(spainX + 300, spainY), COLORS.selected));
await rightDrag(-1500, 0, 30);
await rightDrag(-1500, 0, 30);
const landFraction = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let land = 0;
  for (let i = 0; i < d.length; i += 400) if (d[i] === 0x26 && d[i + 1] === 0x2a) land++;
  return land / (d.length / 400);
});
check("land still drawn after long pan", landFraction > 0.15, `land fraction ${landFraction.toFixed(2)}`);

// Zoom: reload to reset camera, zoom on Spain, Spain must stay under the cursor.
await page.reload();
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

await rightDrag(0, -200);
check("vertical pan works when zoomed", near(await pixel(spainX, spainY - 200), COLORS.selected));

for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 100);
await page.waitForTimeout(1000);
await rightDrag(0, 1000); // push back to vertical center limit
const backAtMin = near(await pixel(eastX, eastY), COLORS.ocean) || near(await pixel(eastX, eastY - 200), COLORS.ocean);
check("zoom out clamps at min zoom (Spain small again)", backAtMin);
await page.keyboard.press("Escape");

// Settings: change selected fill color, check it applies and persists.
await page.click('button[title="Show settings"]');
await page.click("aside.panel-left .collapsible-header >> text=Selected country");
await page.locator('aside.panel-left input[type="color"]').first().fill("#00ff00");
await page.mouse.click(spainX + 400, spainY); // somewhere right of the panel; click Spain needs panel out of the way
await page.click('button[title="Hide settings"]');
await page.mouse.click(spainX, spainY);
check("selected fill color setting applies", near(await pixel(spainX, spainY), [0, 255, 0]));
await page.reload();
await page.waitForSelector("canvas");
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("worldTracker.settings.v2")).styles.dark.selected.fillColor);
check("settings persist across reload", saved === "#00ff00", saved);

// ---------- map types ----------
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector("canvas");
await page.waitForTimeout(300);
const mapTypeSelect = "aside.panel-left select";
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
await rightDrag(-3000, 0, 40);
await page.waitForTimeout(600);
check("satellite: wrap keeps tile coords valid", tileRequests.every((t) => t.x >= 0 && t.x < 2 ** t.z));
const perLevel = {}; for (const t of tileRequests) perLevel[t.z] = (perLevel[t.z] ?? 0) + 1;
check("satellite: request count sane", tileRequests.length < 400, `${tileRequests.length} ${JSON.stringify(perLevel)}`);
await page.screenshot({ path: "/tmp/wt-satellite.png" });

const darkSelected = await page.evaluate(() => JSON.parse(localStorage.getItem("worldTracker.settings.v2")).mapType);
check("map type persists", darkSelected === "satellite");

// Frame cost while panning.
await page.evaluate(() => localStorage.clear());
await page.reload();
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
await rightDrag(-1200, 0, 120);
const frames = await page.evaluate(() => window.__frames.slice(5));
frames.sort((a, b) => a - b);
console.log(`INFO  pan frame time median ${frames[frames.length >> 1].toFixed(1)} ms, p95 ${frames[Math.floor(frames.length * 0.95)].toFixed(1)} ms (headless, software rendering)`);

await page.screenshot({ path: "/tmp/wt-start.png" });
await browser.close();
server?.kill();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
