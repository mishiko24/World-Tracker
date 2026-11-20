// The map's country list, plus helpers to match source-specific codes and names to our country ids.
// Our id = Natural Earth ADM0_A3 (same as the map). Most sources use ISO 3166 alpha-3, which equals it
// except for a few countries listed in CODE_OVERRIDES.

import { readFileSync } from "node:fs";

const NATURAL_EARTH = "data-raw/ne_50m_admin_0_countries.geojson";
const EXCLUDED_IDS = new Set(["ATA"]); // must match scripts/build-geo.mjs

export interface Country {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  isoNumeric: string | null; // zero-padded UN M49, e.g. "004"
  wikidata: string;
}

export type CodeSystem = "worldbank" | "owid" | "eia";

// Where a source's code differs from our id/iso3. Key = our id.
const CODE_OVERRIDES: Record<string, Partial<Record<CodeSystem, string>>> = {
  KOS: { worldbank: "XKX", owid: "OWID_KOS", eia: "XKS" },
};

// Source country names that don't match any Natural Earth name. Key = lowercased source name, value = our id.
const NAME_OVERRIDES: Record<string, string> = {
  "burma": "MMR",
  "congo (kinshasa)": "COD",
  "congo (brazzaville)": "COG",
  "korea, north": "PRK",
  "korea, republic of": "KOR",
  "korea, south": "KOR",
  "cote d'ivoire": "CIV",
  "côte d'ivoire": "CIV",
  "laos": "LAO",
  "russia": "RUS",
  "turkey": "TUR",
  "türkiye": "TUR",
  "united states": "USA",
  "united kingdom": "GBR",
  "czechia": "CZE",
  "czech republic": "CZE",
  "eswatini": "SWZ",
  "swaziland": "SWZ",
  "macedonia": "MKD",
  "north macedonia": "MKD",
  "bosnia and herzegovina": "BIH",
  "dominican republic": "DOM",
  "central african republic": "CAF",
  "equatorial guinea": "GNQ",
  "papua new guinea": "PNG",
  "south sudan": "SSD",
  "timor-leste": "TLS",
  "east timor": "TLS",
  "vietnam": "VNM",
  "viet nam": "VNM",
  "iran": "IRN",
  "syria": "SYR",
  "taiwan": "TWN",
  "brunei": "BRN",
  "cabo verde": "CPV",
  "new caledonia": "NCL",
  "kyrgyzstan": "KGZ",
  "tanzania": "TZA",
  "bolivia": "BOL",
  "venezuela": "VEN",
  "moldova": "MDA",
};

interface NaturalEarthProperties {
  ADM0_A3: string;
  NAME: string;
  NAME_LONG: string;
  ADMIN: string;
  NAME_EN: string;
  FORMAL_EN: string | null;
  NAME_SORT: string;
  BRK_NAME: string;
  ISO_A2_EH: string;
  ISO_A3_EH: string;
  ISO_N3_EH: string;
  WIKIDATAID: string;
}

function cleanCode(code: string): string | null {
  if (code === "-99") {
    return null;
  }
  return code;
}

function loadNaturalEarth(): NaturalEarthProperties[] {
  const geojson = JSON.parse(readFileSync(NATURAL_EARTH, "utf8")) as { features: { properties: NaturalEarthProperties }[] };
  return geojson.features.map((f) => f.properties).filter((p) => !EXCLUDED_IDS.has(p.ADM0_A3));
}

export function loadCountries(): Country[] {
  return loadNaturalEarth().map((p) => ({
    id: p.ADM0_A3,
    name: p.NAME_LONG,
    iso2: cleanCode(p.ISO_A2_EH),
    iso3: cleanCode(p.ISO_A3_EH),
    isoNumeric: cleanCode(p.ISO_N3_EH),
    wikidata: p.WIKIDATAID,
  }));
}

// Natural Earth gives some territories their parent's code (Indian Ocean Ter. and Ashmore and
// Cartier Is. are both "AUS" / "036"). The country whose own id matches the code must win.
function setPreferringOwner(map: Map<string, string>, code: string, id: string, ownerCode: string): void {
  if (!map.has(code) || id === ownerCode) {
    map.set(code, id);
  }
}

// Maps a source's country code to our id. Codes that aren't ours (regions, aggregates) map to nothing.
export function codeMatcher(system: CodeSystem): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of loadCountries()) {
    const code = CODE_OVERRIDES[c.id]?.[system] ?? c.iso3;
    if (code !== null) {
      setPreferringOwner(map, code, c.id, c.iso3 ?? code);
    }
  }
  return map;
}

// Maps a UN M49 numeric code ("036") to our id.
export function numericCodeMatcher(): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of loadCountries()) {
    if (c.isoNumeric !== null) {
      setPreferringOwner(map, c.isoNumeric, c.id, c.iso3 ?? "");
    }
  }
  return map;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ");
}

// Maps a country name to our id using every Natural Earth name variant plus NAME_OVERRIDES.
export function nameMatcher(): (name: string) => string | null {
  const map = new Map<string, string>();
  for (const p of loadNaturalEarth()) {
    for (const n of [p.NAME, p.NAME_LONG, p.ADMIN, p.NAME_EN, p.FORMAL_EN, p.NAME_SORT, p.BRK_NAME]) {
      if (n) {
        map.set(normalizeName(n), p.ADM0_A3);
      }
    }
  }
  for (const [name, id] of Object.entries(NAME_OVERRIDES)) {
    map.set(name, id);
  }
  return (name) => map.get(normalizeName(name)) ?? null;
}
