// Phone layout + touch gestures in a headless phone-sized browser. Real touch input via CDP.
// Run: npm run build && node tests/mobile.mjs   (starts its own preview server on port 4174)

import { spawn } from "node:child_process";
import { chromium } from "playwright";

const URL = "http://localhost:4174/";
const server = spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort"], { stdio: "ignore" });
for (let i = 0; i < 50; i++) {
  if (await fetch(URL).then(() => true, () => false)) break;
  await new Promise((r) => setTimeout(r, 100));
}
const W = 390;
const H = 844;

// Same projection math as src/map/geo.ts: where a lon/lat is on screen at the start view, plus a pan offset.
const WORLD_WIDTH = 1000;
const mercY = (lat) => WORLD_WIDTH / 2 - (WORLD_WIDTH / (2 * Math.PI)) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercX = (lon) => WORLD_WIDTH / 2 + (WORLD_WIDTH / 360) * lon;
const WORLD_TOP = mercY(84);
const WORLD_BOTTOM = mercY(-60);
const SCALE = H / (WORLD_BOTTOM - WORLD_TOP);
const PAN_X = 150; // the test pans right by this first
const at = (lon, lat) => [
  (mercX(lon) - WORLD_WIDTH / 2) * SCALE + W / 2 + PAN_X,
  (mercY(lat) - (WORLD_TOP + WORLD_BOTTOM) / 2) * SCALE + H / 2,
];

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.route("https://static.cloudflareinsights.com/**", (route) => route.abort()); // test runs aren't visits
page.on("pageerror", (e) => check("no page errors", false, e.message));
const cdp = await context.newCDPSession(page);
const wait = (ms) => page.waitForTimeout(ms);

// points: array of [x, y]; each index is one finger.
async function touch(type, points) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
}
async function tap([x, y]) {
  await touch("touchStart", [[x, y]]);
  await touch("touchEnd", []);
  await wait(150);
}
async function longPress([x, y]) {
  await touch("touchStart", [[x, y]]);
  await wait(700);
  await touch("touchEnd", []);
  await wait(150);
}
async function drag(from, to, steps = 10) {
  await touch("touchStart", [from]);
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", [[from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps]]);
  }
  await touch("touchEnd", []);
  await wait(300);
}
// Two fingers on a horizontal line around (cx, cy), spreading from gap0 to gap1 pixels apart.
async function pinch([cx, cy], gap0, gap1, steps = 10) {
  const fingers = (gap) => [
    [cx - gap / 2, cy],
    [cx + gap / 2, cy],
  ];
  await touch("touchStart", fingers(gap0));
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", fingers(gap0 + ((gap1 - gap0) * i) / steps));
  }
  await touch("touchEnd", []);
  await wait(200);
}
const title = async () => (await page.$("aside.panel-right h2")) && page.textContent("aside.panel-right h2");
const compareHeader = async () => (await page.$(".compare-header")) && page.textContent(".compare-header");
const sheetHeight = async () => {
  await wait(300); // snap transition
  return page.evaluate(() => Math.round(document.querySelector("aside.panel-right").getBoundingClientRect().height));
};

await page.goto(URL);
await page.waitForSelector("canvas");
await wait(300);

check("settings start closed on phones", (await page.$("aside.panel-left")) === null && (await page.$(".panel-toggle")) !== null);

// One-finger pan, then tap: Brazil is only where the test expects it if the pan worked.
await drag([100, 400], [100 + PAN_X, 400]);
await tap(at(-52, -10));
check("one-finger pan + tap selects", (await title()) === "Brazil", String(await title()));
const peek = await sheetHeight();
check("info panel opens as peeking bottom sheet", peek === 172, `${peek}px`);

await longPress(at(-75, -10));
check("long press compares", (await compareHeader())?.includes("Peru"), String(await compareHeader()));

await page.tap(".compare-button");
check("Compare button shows pick banner", (await page.$(".pick-banner")) !== null);
await tap(at(-73, 4));
check("tap while picking compares", (await compareHeader())?.includes("Colombia"), String(await compareHeader()));
check("picking ends after the pick", (await page.$(".pick-banner")) === null);
check("selection kept while picking", (await title()) === "Brazil");

// Sheet: tap header -> half, drag up -> full, drag down -> peek.
const header = await page.$eval("aside.panel-right .panel-header", (el) => {
  const r = el.getBoundingClientRect();
  return [r.left + 60, r.top + 30];
});
await tap(header);
const half = await sheetHeight();
check("tap sheet header -> half", Math.abs(half - H / 2) < 2, `${half}px`);
const halfHeader = [header[0], H - half + 30];
await drag(halfHeader, [halfHeader[0], halfHeader[1] - 300]);
const full = await sheetHeight();
check("drag sheet up -> full", Math.abs(full - (H - 64)) < 2, `${full}px`);
await drag([header[0], 64 + 30], [header[0], H - 100]);
check("drag sheet down -> peek", (await sheetHeight()) === 172);

// Pinch x2 around Brazil: Colombia moves twice as far from the pinch center.
const center = at(-52, -10);
const colombia = at(-73, 4);
await pinch(center, 60, 120);
await tap([center[0] + 2 * (colombia[0] - center[0]), center[1] + 2 * (colombia[1] - center[1])]);
check("pinch zooms around the fingers", (await title()) === "Colombia", String(await title()));
check("new selection ends comparison", (await compareHeader()) === null);

// Settings drawer covers the screen.
await page.tap(".panel-toggle");
const drawer = await page.$eval("aside.panel-left", (el) => {
  const r = el.getBoundingClientRect();
  return [r.width, r.height];
});
check("settings is a full-screen drawer", drawer[0] === W && drawer[1] === H, drawer.join("x"));

await page.tap(".list-view-toggle input");
await page.tap('button[title="Hide settings"]');
const list = await page.$eval(".country-list", (el) => {
  const r = el.getBoundingClientRect();
  return [r.left, r.width];
});
check("list view is full width", list[0] === 0 && list[1] === W, list.join(","));
await page.tap(".country-list tbody tr:nth-child(2) td");
check("tapping a list row selects", (await title()) !== null, String(await title()));

await page.screenshot({ path: "/tmp/mobile-list.png" });
// ---------- phone sideways (844x390): compact layout ----------
const landscape = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const side = await landscape.newPage();
await side.route("https://static.cloudflareinsights.com/**", (route) => route.abort()); // test runs aren't visits
await side.goto(`${URL}?c=BRA`);
await side.waitForSelector("aside.panel-right .panel-title");
check("sideways: settings start closed", (await side.$("aside.panel-left")) === null);
await side.waitForTimeout(300); // slide-in animation
const sidePanel = await side.$eval("aside.panel-right", (el) => {
  const r = el.getBoundingClientRect();
  return { width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right), grip: getComputedStyle(el.querySelector(".sheet-grip")).display };
});
check(
  "sideways: info panel is a slim full-height side panel, not a bottom sheet",
  sidePanel.width === 320 && sidePanel.height === 378 && sidePanel.right === 838 && sidePanel.grip === "none",
  JSON.stringify(sidePanel),
);
await side.tap(".panel-toggle");
const sideDrawer = await side.$eval("aside.panel-left", (el) => [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)]);
check("sideways: settings open full screen", sideDrawer[0] === 844 && sideDrawer[1] === 390, sideDrawer.join("x"));
await landscape.close();

await browser.close();
server.kill();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
