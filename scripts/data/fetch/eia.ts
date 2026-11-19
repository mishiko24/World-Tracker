// U.S. EIA International Energy Data (public domain, free API key in env EIA_API_KEY).
// Oil, natural gas and coal: production and reserves, converted to canonical units.
//
// SECURITY: the key is only ever placed in request URLs; errors use labels, never URLs.

import type { AmountUnit } from "../../../src/data/countryData.ts";
import { codeMatcher } from "../lib/countries.ts";
import { fetchJson, lastFullYear, writeCache } from "../lib/io.ts";

const PAGE_SIZE = 5000; // API maximum for JSON
const YEARS_BACK = 8; // reserves are sometimes reported with a lag

// Multipliers from EIA unit codes to canonical units.
const UNIT_FACTORS: Record<string, number> = {
  TBPD: 1000, // thousand barrels per day -> barrels per day
  BB: 1e9, // billion barrels -> barrels
  BCM: 1e9, // billion cubic meters -> m³
  BCF: 28.316846592e6, // billion cubic feet -> m³
  TCF: 28.316846592e9, // trillion cubic feet -> m³
  MT: 1000, // thousand metric tons -> t
  TST: 907.18474, // thousand short tons -> t
  MST: 907184.74, // million short tons -> t
};

interface Series {
  resource: "oil" | "gas" | "coal";
  kind: "production" | "reserves";
  productId: string;
  activityId: string;
  preferredUnits: string[]; // first one available wins
  unit: AmountUnit;
}

const SERIES: Series[] = [
  { resource: "oil", kind: "production", productId: "57", activityId: "1", preferredUnits: ["TBPD"], unit: "bbl/day" },
  { resource: "oil", kind: "reserves", productId: "57", activityId: "6", preferredUnits: ["BB"], unit: "bbl" },
  { resource: "gas", kind: "production", productId: "26", activityId: "1", preferredUnits: ["BCM", "BCF"], unit: "m³/year" },
  { resource: "gas", kind: "reserves", productId: "26", activityId: "6", preferredUnits: ["TCF", "BCM", "BCF"], unit: "m³" },
  { resource: "coal", kind: "production", productId: "7", activityId: "1", preferredUnits: ["MT", "TST"], unit: "t/year" },
  { resource: "coal", kind: "reserves", productId: "7", activityId: "6", preferredUnits: ["MST", "MT"], unit: "t" },
];

export interface EiaAmount {
  value: number;
  unit: AmountUnit;
  year: number;
  worldRank: number;
  worldShare: number;
}

export type EiaEntry = Partial<Record<`${Series["resource"]}.${Series["kind"]}`, EiaAmount>>;

interface ApiRow {
  period: string;
  countryRegionId: string;
  countryRegionTypeId: string;
  unit: string;
  value: string | number | null;
}

async function fetchSeries(series: Series, key: string): Promise<ApiRow[]> {
  const rows: ApiRow[] = [];
  const start = lastFullYear() - YEARS_BACK;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url =
      `https://api.eia.gov/v2/international/data/?api_key=${key}&frequency=annual&data[0]=value` +
      `&facets[productId][]=${series.productId}&facets[activityId][]=${series.activityId}` +
      `&start=${start}&offset=${offset}&length=${PAGE_SIZE}`;
    const page = await fetchJson<{ response: { total: string | number; data: ApiRow[] } }>(
      url,
      `EIA ${series.resource} ${series.kind} (offset ${offset})`,
    );
    rows.push(...page.response.data);
    if (offset + PAGE_SIZE >= Number(page.response.total)) {
      return rows;
    }
  }
}

// Diagnostic for a misconfigured series: which products (and units) exist for an activity.
async function productsForActivity(activityId: string, key: string): Promise<string> {
  const url =
    `https://api.eia.gov/v2/international/data/?api_key=${key}&frequency=annual&data[0]=value` +
    `&facets[activityId][]=${activityId}&facets[countryRegionId][]=SAU&facets[countryRegionId][]=USA&start=${lastFullYear() - 3}&length=${PAGE_SIZE}`;
  const page = await fetchJson<{ response: { data: (ApiRow & { productId: string; productName: string })[] } }>(
    url,
    `EIA products for activity ${activityId}`,
  );
  const seen = new Set(page.response.data.map((r) => `${r.productId} ${r.productName} [${r.unit}]`));
  return [...seen].join("; ");
}

export async function fetchEia(): Promise<void> {
  const key = (process.env.EIA_API_KEY ?? "").trim();
  if (key === "") {
    throw new Error("EIA_API_KEY is not set");
  }
  const ourId = codeMatcher("eia");
  const byCountry: Record<string, EiaEntry> = {};

  for (const series of SERIES) {
    const rows = await fetchSeries(series, key);
    const units = new Set(rows.map((r) => r.unit));
    const unit = series.preferredUnits.find((u) => units.has(u));
    if (unit === undefined) {
      const available = await productsForActivity(series.activityId, key);
      throw new Error(
        `EIA ${series.resource} ${series.kind}: none of ${series.preferredUnits.join("/")} in units [${[...units].join(", ")}]. ` +
          `Products with activity ${series.activityId}: ${available}`,
      );
    }
    const factor = UNIT_FACTORS[unit];

    // Latest numeric value per country (country rows only, no regions).
    const latest = new Map<string, { value: number; year: number }>();
    for (const row of rows) {
      const value = Number(row.value);
      if (row.unit !== unit || row.countryRegionTypeId !== "c" || row.value === null || !Number.isFinite(value)) {
        continue;
      }
      const year = Number(row.period);
      const previous = latest.get(row.countryRegionId);
      if (previous === undefined || year > previous.year) {
        latest.set(row.countryRegionId, { value: value * factor, year });
      }
    }

    // World rank and share are computed among countries reporting the same year.
    const byYear = new Map<number, number[]>();
    for (const { value, year } of latest.values()) {
      byYear.set(year, [...(byYear.get(year) ?? []), value]);
    }

    let matched = 0;
    const unmatched: string[] = [];
    for (const [code, { value, year }] of latest) {
      const id = ourId.get(code);
      if (id === undefined) {
        if (value > 0) {
          unmatched.push(code);
        }
        continue;
      }
      if (value <= 0) {
        continue;
      }
      const sameYear = byYear.get(year)!;
      const total = sameYear.reduce((sum, v) => sum + v, 0);
      byCountry[id] ??= {};
      byCountry[id][`${series.resource}.${series.kind}`] = {
        value,
        unit: series.unit,
        year,
        worldRank: 1 + sameYear.filter((v) => v > value).length,
        worldShare: value / total,
      };
      matched++;
    }
    console.log(`  ${series.resource} ${series.kind} [${unit}]: ${matched} countries; unmatched codes with data: ${unmatched.join(" ") || "none"}`);
  }

  writeCache("eia", byCountry);
}
