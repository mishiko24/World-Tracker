// Oil and gas proved reserves: Energy Institute Statistical Review, via Our World in Data graphers.
// The EI paused reserves updates after 2020 (methodology review), and EIA's API dropped oil and gas
// reserves, so these figures stop at 2020. The year is shown next to every value.
// (OPEC's bulletin has newer numbers but blocks automated downloads.)

import type { AmountUnit } from "../../../src/data/countryData.ts";
import { codeMatcher } from "../lib/countries.ts";
import { parseCsv } from "../lib/csv.ts";
import { fetchText, writeCache } from "../lib/io.ts";

const BARRELS_PER_TONNE = 7.33; // EI's average conversion factor for crude oil

const SERIES = [
  { resource: "oil", slug: "oil-proved-reserves", factor: BARRELS_PER_TONNE, unit: "bbl" }, // tonnes -> barrels
  { resource: "gas", slug: "gas-proved-reserves", factor: 1, unit: "m³" },
] as const;

export interface EiReserve {
  value: number;
  unit: AmountUnit;
  year: number;
  worldRank: number;
  worldShare: number | null;
}

export type EiReservesEntry = Partial<Record<"oil" | "gas", EiReserve>>;

export async function fetchEiReserves(): Promise<void> {
  const ourId = codeMatcher("owid");
  const byCountry: Record<string, EiReservesEntry> = {};

  for (const series of SERIES) {
    const rows = parseCsv(
      await fetchText(`https://ourworldindata.org/grapher/${series.slug}.csv?v=1&csvType=full&useColumnShortNames=true`, `OWID ${series.slug}`),
    );
    const column = Object.keys(rows[0])[3];
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
    console.log(`  ${series.slug}: column ${column}, year ${latestYear}, ${countries.length} countries; Saudi Arabia = ${saudi?.toExponential(3)} ${series.unit}`);
  }

  writeCache("eireserves", byCountry);
}
