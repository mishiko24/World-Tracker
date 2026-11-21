// Builds public/flags/<ID>.png: one small flag per country on the map, named by our country id (ADM0_A3, "USA"),
// and public/flags/large/<ID>.png (480x360) for share cards, where the flag fills the card's header.
// Every id gets a file; places without a flag (Northern Cyprus, Somaliland, Siachen Glacier) get a plain placeholder,
// so the UI never has to check whether a flag exists.
//
// Source: flag-icons (MIT, https://github.com/lipis/flag-icons), its flags/4x3/<iso2>.svg files.
// The SVGs are rendered once to 96x72 PNGs (2x the largest chip): the full SVGs are 2.7 MB because of detailed coats
// of arms that are invisible at chip size, and PNGs also draw straight onto share-card canvases.
// They're loaded as <img> data URLs in headless Chrome, so nothing in them can run.
//
// Run (rarely, e.g. when a country's flag changes):
//   git clone --depth 1 https://github.com/lipis/flag-icons.git /tmp/vendor/flag-icons
//   node scripts/build-flags.mjs /tmp/vendor/flag-icons

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const SIZES = [
  { width: 96, height: 72, folder: "public/flags" },
  { width: 480, height: 360, folder: "public/flags/large" },
];
const OUTPUT = "public/flags";
const PLACEHOLDER_COLOR = "#3a3a40";

const checkout = process.argv[2];
if (checkout === undefined) {
  throw new Error("Usage: node scripts/build-flags.mjs <path to a flag-icons checkout>");
}

const countries = JSON.parse(readFileSync("public/data/countries.topo.json", "utf8")).objects.countries.geometries.map(
  (g) => g.properties,
);

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
const page = await browser.newPage();

async function render(svgDataUrl, width, height) {
  return page.evaluate(
    async ([src, width, height, placeholder]) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (src === null) {
        ctx.fillStyle = placeholder;
        ctx.fillRect(0, 0, width, height);
      } else {
        const img = new Image();
        img.src = src;
        await img.decode();
        ctx.drawImage(img, 0, 0, width, height);
      }
      return canvas.toDataURL("image/png");
    },
    [svgDataUrl, width, height, PLACEHOLDER_COLOR],
  );
}

for (const size of SIZES) {
  mkdirSync(size.folder, { recursive: true });
}
const missing = [];
for (const country of countries) {
  const svgPath = country.iso2 === null ? null : `${checkout}/flags/4x3/${country.iso2.toLowerCase()}.svg`;
  const hasFlag = svgPath !== null && existsSync(svgPath);
  if (!hasFlag) {
    missing.push(country.name);
  }
  const svg = hasFlag ? `data:image/svg+xml;base64,${readFileSync(svgPath).toString("base64")}` : null;
  for (const size of SIZES) {
    const dataUrl = await render(svg, size.width, size.height);
    writeFileSync(`${size.folder}/${country.id}.png`, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
  }
}
copyFileSync(`${checkout}/LICENSE`, `${OUTPUT}/LICENSE-flag-icons.txt`);
await browser.close();

console.log(`${countries.length} flags written to ${OUTPUT}/; placeholder for: ${missing.join(", ")}`);
