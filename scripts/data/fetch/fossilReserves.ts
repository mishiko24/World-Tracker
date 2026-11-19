// Oil and gas proved reserves: EIA figures republished by Our World in Data (grapher CSVs, physical units).
// EIA's own API no longer serves oil/gas reserves, but OWID kept the last series (to 2021).
// The Energy Institute stopped at 2020; OPEC has newer numbers but blocks automated downloads (403).

import type { AmountUnit } from "../../../src/data/countryData.ts";
import { codeMatcher } from "../lib/countries.ts";
import { parseCsv } from "../lib/csv.ts";
import { fetchText, writeCache } from "../lib/io.ts";

const BARRELS_PER_CUBIC_METER = 6.289811; // exact unit conversion

const SERIES = [
  { resource: "oil", slug: "oil-proved-reserves", factor: BARRELS_PER_CUBIC_METER, unit: "bbl" },
  { resource: "gas", slug: "natural-gas-proved-reserves", factor: 1, unit: "m³" },
] as const;

export interface FossilReserve {
  value: number;
  unit: AmountUnit;
  year: number;
  worldRank: number;
  worldShare: number | null;
}

export type FossilReservesEntry = Partial<Record<"oil" | "gas", FossilReserve>>;

export async function fetchFossilReserves(): Promise<void> {
  const ourId = codeMatcher("owid");
  const byCountry: Record<string, FossilReservesEntry> = {};

  for (const series of SERIES) {
    const rows = parseCsv(
      await fetchText(`https://ourworldindata.org/grapher/${series.slug}.csv?v=1&csvType=full&useColumnShortNames=true`, `OWID ${series.slug}`),
    );
    const columns = Object.keys(rows[0]);
    const column = columns.find((c) => c.endsWith("_m3"));
    if (column === undefined) {
      throw new Error(`OWID ${series.slug}: no *_m3 column; columns are ${columns.join(", ")}`);
    }
    const latestYear = Math.max(...rows.filter((r) => r[column] !== "").map((r) => Number(r.year)));
    const current = rows.filter((r) => Number(r.year) === latestYear && r[column] !== "");
    const world = current.find((r) => r.code === "OWID_WRL");
    const countries = current
      .map((r) => ({ id: ourId.get(r.code), value: Number(r[column]) * series.factor }))
      .filter((c): c is { id: string; value: number } => c.id !== undefined && c.value > 0);

    for (const c of countries) {
      byCountry[c.id] ??= {};
      byCountry[c.id][series.resource] = {
        value: c.value,
        unit: series.unit,
        year: latestYear,
        worldRank: 1 + countries.filter((other) => other.value > c.value).length,
        worldShare: world ? c.value / (Number(world[column]) * series.factor) : null,
      };
    }
    const saudi = byCountry.SAU?.[series.resource]?.value;
    console.log(`  ${series.slug}: column ${column} (of ${columns.slice(3).join(", ")}), year ${latestYear}, ${countries.length} countries, world row ${world ? "yes" : "no"}; Saudi Arabia = ${saudi?.toExponential(4)} ${series.unit}`);
  }

  writeCache("reserves", byCountry);
}
