// Builds public/flags/<ID>.svg: one vector flag per country on the map, named by our country id (ADM0_A3, "USA").
// Vector, so flags are sharp at every size: 16px chips, game cards, share cards (drawn on canvas at card size).
// Every id gets a file; places without a flag (Northern Cyprus, Somaliland, Siachen Glacier) get a plain placeholder,
// so the UI never has to check whether a flag exists.
//
// Source: flag-icons (MIT, https://github.com/lipis/flag-icons), its flags/4x3/<iso2>.svg files (4:3, 640x480).
// Optimized with svgo (about half the size; the detailed coats of arms are the big ones). Browsers only load the
// flags on screen, and an SVG shown through <img> or drawn on a canvas can't run anything.
//
// Run (rarely, e.g. when a country's flag changes):
//   git clone --depth 1 https://github.com/lipis/flag-icons.git /tmp/vendor/flag-icons
//   node scripts/build-flags.mjs /tmp/vendor/flag-icons

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { optimize } from "svgo";

const OUTPUT = "public/flags";
const PLACEHOLDER = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><path fill="#3d4489" d="M0 0h640v480H0z"/></svg>';

const checkout = process.argv[2];
if (checkout === undefined) {
  throw new Error("Usage: node scripts/build-flags.mjs <path to a flag-icons checkout>");
}

const countries = JSON.parse(readFileSync("public/data/countries.topo.json", "utf8")).objects.countries.geometries.map(
  (g) => g.properties,
);

// Start clean, so no flag of a country that left the map stays behind.
rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });

const missing = [];
for (const country of countries) {
  const svgPath = country.iso2 === null ? null : `${checkout}/flags/4x3/${country.iso2.toLowerCase()}.svg`;
  if (svgPath === null || !existsSync(svgPath)) {
    missing.push(country.name);
    writeFileSync(`${OUTPUT}/${country.id}.svg`, PLACEHOLDER);
    continue;
  }
  // The sources have only a viewBox; canvases need an intrinsic size to draw the image, so 640x480 is added.
  const { data } = optimize(readFileSync(svgPath, "utf8"), {
    multipass: true,
    floatPrecision: 1, // 0.1 of a 640px-wide flag: invisible even on a full-screen card
    plugins: ["preset-default", { name: "addAttributesToSVGElement", params: { attributes: [{ width: "640" }, { height: "480" }] } }],
  });
  if (!data.includes('width="640"') || !data.includes('height="480"')) {
    throw new Error(`${country.id}: optimized flag lost its 640x480 size`);
  }
  writeFileSync(`${OUTPUT}/${country.id}.svg`, data);
}
copyFileSync(`${checkout}/LICENSE`, `${OUTPUT}/LICENSE-flag-icons.txt`);

const bytes = readdirSync(OUTPUT).reduce((sum, f) => sum + readFileSync(`${OUTPUT}/${f}`).length, 0);
console.log(`${countries.length} flags written to ${OUTPUT}/ (${(bytes / 1e6).toFixed(1)} MB); placeholder for: ${missing.join(", ")}`);
