// USGS Mineral Commodity Summaries data release (CC0, no key): world mine production and reserves
// for 90+ non-fuel minerals. Only major producers are listed per mineral; the rest are "Other countries".
// Countries are given by name, matched with lib/countries.ts nameMatcher().
//
// New edition every year (Jan/Feb) under a new ScienceBase item: update SCIENCEBASE_ITEM then.

import type { AmountUnit } from "../../../src/data/countryData.ts";
import { nameMatcher } from "../lib/countries.ts";
import { parseCsv } from "../lib/csv.ts";
import { fetchBytes, fetchJson, writeCache } from "../lib/io.ts";

const SCIENCEBASE_ITEM = "69837e43b66b01367d7ec7c7"; // MCS 2026 commodities data
const NOT_COUNTRIES = new Set(["other countries", "world total", "world total (rounded)", "world total, rounded"]);

// USGS unit text -> canonical unit and multiplier. Units not listed are skipped (and logged).
const UNITS: Record<string, { unit: "t" | "kg" | "carats" | "m³"; factor: number }> = {
  "metric tons": { unit: "t", factor: 1 },
  "thousand metric tons": { unit: "t", factor: 1e3 },
  "million metric tons": { unit: "t", factor: 1e6 },
  "kilograms": { unit: "kg", factor: 1 },
  "carats": { unit: "carats", factor: 1 },
  "thousand carats": { unit: "carats", factor: 1e3 },
  "million carats": { unit: "carats", factor: 1e6 },
  "million cubic meters": { unit: "m³", factor: 1e6 },
  "thousand metric dry tons": { unit: "t", factor: 1e3 },
  "thousands of carats": { unit: "carats", factor: 1e3 },
};

export interface UsgsAmount {
  value: number;
  unit: AmountUnit;
  year: number;
  worldRank: number;
  worldShare: number | null;
}

export interface UsgsMineral {
  name: string;
  production: UsgsAmount | null;
  reserves: UsgsAmount | null;
}

export type UsgsEntry = Record<string, UsgsMineral>; // key = mineral id

interface Observation {
  mineralId: string;
  mineralName: string;
  kind: "production" | "reserves";
  country: string;
  value: number;
  unit: { unit: "t" | "kg" | "carats" | "m³"; factor: number };
  year: number;
  detail: string;
  rounded: boolean;
}

function mineralId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// "1,234" -> 1234; "—" (none) -> 0; withheld/unknown ("W", "NA", "XX", "") -> null.
function parseValue(text: string): number | null {
  const cleaned = text.replace(/[,<>\s]/g, "").replace(/e$/, "");
  if (cleaned === "—" || cleaned === "-" || cleaned === "–") {
    return 0;
  }
  const value = Number(cleaned);
  if (cleaned === "" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

// Which statistic a row is: mine production, reserves, or something we don't show (smelter output, capacity, ...).
function kindOf(row: Record<string, string>): "production" | "reserves" | null {
  const detail = row.Statistics_detail.toLowerCase();
  if (row.Statistics === "Reserves") {
    return "reserves";
  }
  if (row.Statistics === "Production" && detail.includes("mine production")) {
    return "production";
  }
  return null;
}

export async function fetchUsgs(): Promise<void> {
  const item = await fetchJson<{ files: { name: string; url: string }[] }>(
    `https://www.sciencebase.gov/catalog/item/${SCIENCEBASE_ITEM}?format=json`,
    "USGS ScienceBase item",
  );
  const file = item.files.find((f) => f.name.endsWith("Commodities_Data.csv"));
  if (file === undefined) {
    throw new Error(`USGS: no *Commodities_Data.csv in item; files: ${item.files.map((f) => f.name).join(", ")}`);
  }
  const text = new TextDecoder("windows-1252").decode(await fetchBytes(file.url, "USGS commodities CSV"));
  writeCache("usgs", parseUsgsCsv(text));
}

// Separate from the download so it can be tested on a saved file.
export function parseUsgsCsv(text: string): Record<string, UsgsEntry> {
  const rows = parseCsv(text).filter((r) => r.Section.startsWith("World"));

  const matchName = nameMatcher();
  const observations: Observation[] = [];
  const skippedUnits = new Set<string>();
  const unmatchedNames = new Set<string>();
  const used = new Set<string>();
  for (const row of rows) {
    const kind = kindOf(row);
    const value = parseValue(row.Value);
    const unit = UNITS[row.Unit.trim().toLowerCase()];
    if (kind === null || value === null) {
      continue;
    }
    if (unit === undefined) {
      skippedUnits.add(`${row.Commodity}: ${row.Unit}`);
      continue;
    }
    used.add(`${row.Section} | ${row.Commodity} | ${row.Statistics_detail}`);
    observations.push({
      mineralId: mineralId(row.Commodity),
      mineralName: row.Commodity,
      kind,
      country: row.Country,
      value: value * unit.factor,
      unit,
      year: Number(row.Year.replace(/\D/g, "")),
      detail: row.Statistics_detail,
      rounded: row.Statistics_detail.toLowerCase().includes("rounded"),
    });
  }
  observations.sort((a, b) => Number(a.rounded) - Number(b.rounded)); // stable: unrounded first

  // A mineral can be reported in several variants (e.g. iron ore: "Iron content" and "Usable ore",
  // plus ": rounded" copies). Ranks only make sense within one variant, so per mineral/kind use only
  // the first unrounded variant in the file (the headline figure), or the first rounded one if that's all.
  const chosenDetail = new Map<string, string>();
  for (const o of observations) {
    const key = `${o.mineralId}|${o.kind}`;
    if (!chosenDetail.has(key)) {
      chosenDetail.set(key, o.detail);
    }
  }
  const chosen = observations.filter((o) => o.detail === chosenDetail.get(`${o.mineralId}|${o.kind}`));

  // Latest year per mineral/kind within the chosen variant.
  const latestYear = new Map<string, number>();
  for (const o of chosen) {
    const key = `${o.mineralId}|${o.kind}`;
    latestYear.set(key, Math.max(latestYear.get(key) ?? 0, o.year));
  }

  const byCountry: Record<string, UsgsEntry> = {};
  for (const [key, detail] of chosenDetail) {
    const year = latestYear.get(key)!;
    const [id, kind] = key.split("|");
    const group = chosen.filter((o) => `${o.mineralId}|${o.kind}` === key && o.year === year);
    // The world total is sometimes only given in the rounded copy of the variant.
    const world =
      group.find((o) => o.country.toLowerCase().startsWith("world total")) ??
      observations.find(
        (o) => o.mineralId === id && o.kind === kind && o.year === year && o.detail.startsWith(detail) &&
          o.country.toLowerCase().startsWith("world total"),
      );
    const countries = group.filter((o) => !NOT_COUNTRIES.has(o.country.toLowerCase()) && o.value > 0);
    for (const o of countries) {
      const ourId = matchName(o.country);
      if (ourId === null) {
        unmatchedNames.add(o.country);
        continue;
      }
      const amount: UsgsAmount = {
        value: o.value,
        unit: (o.kind === "production" ? `${o.unit.unit}/year` : o.unit.unit) as AmountUnit,
        year: o.year,
        worldRank: 1 + countries.filter((other) => other.value > o.value).length,
        worldShare: world ? o.value / world.value : null,
      };
      byCountry[ourId] ??= {};
      byCountry[ourId][o.mineralId] ??= { name: o.mineralName, production: null, reserves: null };
      byCountry[ourId][o.mineralId][o.kind] = amount;
    }
  }

  console.log(`  used rows from:\n    ${[...used].sort().join("\n    ")}`);
  console.log(`  skipped units: ${[...skippedUnits].join("; ") || "none"}`);
  if (unmatchedNames.size > 0) {
    throw new Error(`USGS: unmatched country names (add to NAME_OVERRIDES): ${[...unmatchedNames].join(", ")}`);
  }
  return byCountry;
}
