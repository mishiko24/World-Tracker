// Dev tool: selects the country at a lon/lat, opens every info section, screenshots the panel.
// Run: npm run build && node tests/panel-screenshot.mjs <lon> <lat> <out.png>
// Serves the build itself on port 4174.

import { spawn } from "node:child_process";
import { chromium } from "playwright";

const [lon, lat, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4] ?? "/tmp/panel.png"];
const W = 1600;
const H = 1000;

// Same projection as src/map/geo.ts at the start view.
const WORLD_WIDTH = 1000;
const mercY = (la) => WORLD_WIDTH / 2 - (WORLD_WIDTH / (2 * Math.PI)) * Math.log(Math.tan(Math.PI / 4 + (la * Math.PI) / 360));
const top = mercY(84);
const bottom = mercY(-60);
const scale = H / (bottom - top);
const x = (WORLD_WIDTH / 360) * lon * scale + W / 2;
const y = (mercY(lat) - (top + bottom) / 2) * scale + H / 2;

const server = spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("console", (m) => {
  if (m.type() === "error") console.log("console error:", m.text());
});
await page.goto("http://localhost:4174/");
await page.waitForSelector("canvas");
await page.waitForTimeout(400);
await page.click('button[title="Hide settings"]');
await page.mouse.click(x, y);
await page.waitForSelector("aside.panel-right");
for (const t of ["Government", "Population", "Economy", "Resources", "Agriculture", "Power generation"]) {
  await page.click(`aside.panel-right .collapsible-header >> text=${t}`);
}
await page.waitForTimeout(400);
// Let the panel grow to full height for the screenshot.
await page.evaluate(() => {
  const panel = document.querySelector("aside.panel-right");
  panel.style.bottom = "auto";
  panel.querySelector(".panel-scroll").style.overflow = "visible";
});
await page.setViewportSize({ width: W, height: 5000 });
await page.waitForTimeout(200);
await (await page.$("aside.panel-right")).screenshot({ path: out });
console.log(`${await page.textContent("aside.panel-right h2")} -> ${out}`);
await browser.close();
server.kill();
