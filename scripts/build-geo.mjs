// Builds public/data/countries.topo.json from the Natural Earth 50m admin-0 countries GeoJSON.
//
// Source file (download once into data-raw/):
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
//
// Run: npm run build:geo

import { readFileSync, writeFileSync } from "node:fs";
import { topology } from "topojson-server";

const SOURCE = "data-raw/ne_50m_admin_0_countries.geojson";
const OUTPUT = "public/data/countries.topo.json";

// Countries we never show on the map.
const EXCLUDED_IDS = new Set(["ATA"]); // Antarctica

function cleanCode(code) {
  if (code === "-99") {
    return null;
  }
  return code;
}

const source = JSON.parse(readFileSync(SOURCE, "utf8"));
const displayNames = JSON.parse(readFileSync("scripts/displayNames.json", "utf8"));

const features = [];
for (const feature of source.features) {
  const p = feature.properties;
  if (EXCLUDED_IDS.has(p.ADM0_A3)) {
    continue;
  }
  features.push({
    type: "Feature",
    geometry: feature.geometry,
    properties: {
      id: p.ADM0_A3, // unique for every Natural Earth country, including Kosovo (KOS), Somaliland (SOL)
      name: displayNames[p.ADM0_A3] ?? p.NAME_LONG,
      iso2: cleanCode(p.ISO_A2_EH),
      iso3: cleanCode(p.ISO_A3_EH),
      isoNumeric: cleanCode(p.ISO_N3_EH), // UN M49 code, used by FAOSTAT
      wikidata: p.WIKIDATAID, // used later to join country data
      label: [p.LABEL_X, p.LABEL_Y], // lon/lat of a good point inside the country (used for microstate dots)
    },
  });
}

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

const topo = topology({ countries: { type: "FeatureCollection", features } }, 1e5);
writeFileSync(OUTPUT, JSON.stringify(topo));

console.log(`Wrote ${features.length} countries to ${OUTPUT}`);
