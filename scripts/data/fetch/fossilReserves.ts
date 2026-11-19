// Oil and gas proved reserves: EIA figures republished by Our World in Data (grapher CSVs, physical units).
// EIA's own API no longer serves oil/gas reserves, but OWID kept the last series (to 2021).
// The Energy Institute stopped at 2020; OPEC has newer numbers but blocks automated downloads (403).

import type { AmountUnit } from "../../../src/data/countryData.ts";
import { codeMatcher } from "../lib/countries.ts";
import { parseCsv } from "../lib/csv.ts";
import { fetchText, writeCache } from "../lib/io.ts";

const BARRELS_PER_CUBIC_METER = 6.289811; // exact unit conversion
const MAX_AGE_YEARS = 10; // a country's figure older than this (vs. the newest year) is too stale to show

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
    // Each country's latest year; rank and share are computed among countries reporting that same year.
    const latest = new Map<string, { value: number; year: number }>();
    let world: { value: number; year: number }[] = [];
    for (const r of rows) {
      if (r[column] === "") {
        continue;
      }
      const year = Number(r.year);
      const value = Number(r[column]) * series.factor;
      if (r.code === "OWID_WRL") {
        world.push({ value, year });
        continue;
      }
      const id = ourId.get(r.code);
      const previous = id === undefined ? undefined : latest.get(id);
      if (id !== undefined && (previous === undefined || year > previous.year)) {
        latest.set(id, { value, year });
      }
    }
    world = world.sort((a, b) => b.year - a.year);
    const newestYear = Math.max(...[...latest.values()].map((v) => v.year));
    const countries = [...latest]
      .map(([id, v]) => ({ id, ...v }))
      .filter((c) => c.value > 0 && c.year >= newestYear - MAX_AGE_YEARS);

    for (const c of countries) {
      const sameYear = countries.filter((other) => other.year === c.year);
      const worldTotal = world.find((w) => w.year === c.year);
      byCountry[c.id] ??= {};
      byCountry[c.id][series.resource] = {
        value: c.value,
        unit: series.unit,
        year: c.year,
        worldRank: 1 + sameYear.filter((other) => other.value > c.value).length,
        worldShare: worldTotal ? c.value / worldTotal.value : null,
      };
    }
    const saudi = byCountry.SAU?.[series.resource]?.value;
    const years = [...new Set(countries.map((c) => c.year))].sort().join(",");
    console.log(`  ${series.slug}: column ${column}, years ${years}, ${countries.length} countries; Saudi Arabia = ${saudi?.toExponential(4)}, USA = ${byCountry.USA?.[series.resource]?.value.toExponential(4)} ${series.unit}`);
  }

  writeCache("reserves", byCountry);
}
