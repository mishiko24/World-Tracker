// UN World Population Prospects, via Our World in Data grapher CSVs (CC BY).
// Median age (the World Bank doesn't publish it), plus fallbacks for countries the World Bank
// doesn't cover (e.g. Taiwan). Only estimates are used, never projections.

import { codeMatcher } from "../lib/countries.ts";
import { parseCsv } from "../lib/csv.ts";
import { fetchText, lastFullYear, writeCache } from "../lib/io.ts";

// grapher slug -> the column holding historical estimates
const SERIES = {
  medianAge: { slug: "median-age", column: "median_age__sex_all__age_all__variant_estimates" },
  fertility: { slug: "children-born-per-woman", column: "fertility_rate_hist" },
  lifeExpectancy: { slug: "life-expectancy", column: "" }, // "" = first value column
  population: { slug: "population", column: "" },
} as const;

export type UnWppField = keyof typeof SERIES;
export type UnWppEntry = Partial<Record<UnWppField, { value: number; year: number }>>;

export async function fetchUnWpp(): Promise<void> {
  const ourId = codeMatcher("owid");
  const byCountry: Record<string, UnWppEntry> = {};

  for (const [field, { slug, column }] of Object.entries(SERIES) as [UnWppField, { slug: string; column: string }][]) {
    const csv = await fetchText(
      `https://ourworldindata.org/grapher/${slug}.csv?v=1&csvType=full&useColumnShortNames=true`,
      `OWID ${slug}`,
    );
    const rows = parseCsv(csv);
    const valueColumn = column || Object.keys(rows[0])[3];
    if (!(valueColumn in rows[0])) {
      throw new Error(`OWID ${slug}: column ${valueColumn} missing; columns are ${Object.keys(rows[0]).join(", ")}`);
    }
    console.log(`  ${slug}: using column ${valueColumn}`);
    for (const row of rows) {
      const id = ourId.get(row.code);
      const year = Number(row.year);
      if (id === undefined || row[valueColumn] === "" || year > lastFullYear()) {
        continue;
      }
      const previous = byCountry[id]?.[field];
      if (previous === undefined || year > previous.year) {
        byCountry[id] ??= {};
        byCountry[id][field] = { value: Number(row[valueColumn]), year };
      }
    }
  }

  writeCache("unwpp", byCountry);
}
