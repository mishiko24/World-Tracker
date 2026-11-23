// Government spending by function (COFOG), as percent of GDP:
// - Eurostat gov_10a_exp for EU and EFTA countries (newest: provisional figures for last year),
// - OECD Government at a Glance, republished by Our World in Data, for the other OECD members that report it.
//
// The OECD's own SDMX API fails (HTTP 500) on any filtered query, so its numbers come through OWID's CSV.
// A country's year is the newest one with all 10 functions.

import { BUDGET_FUNCTIONS, type BudgetFunctionId } from "../../../src/data/countryData.ts";
import { codeMatcher, loadCountries } from "../lib/countries.ts";
import { parseCsv } from "../lib/csv.ts";
import { fetchJson, fetchText, lastFullYear, writeCache } from "../lib/io.ts";

const YEARS_BACK = 6; // query this many years; older figures aren't worth showing

export interface BudgetEntry {
  year: number;
  source: "eurostat" | "oecd";
  percentOfGdp: Record<BudgetFunctionId, number>;
}

type Years = Map<number, Partial<Record<BudgetFunctionId, number>>>;

export async function fetchBudget(): Promise<void> {
  const byCountry: Record<string, BudgetEntry> = {};
  for (const [id, years] of await eurostat()) {
    const newest = newestComplete(years);
    if (newest !== null) {
      byCountry[id] = { ...newest, source: "eurostat" };
    }
  }
  for (const [id, years] of await oecd()) {
    const newest = newestComplete(years);
    if (newest !== null && byCountry[id] === undefined) {
      byCountry[id] = { ...newest, source: "oecd" };
    }
  }
  for (const id of ["DEU", "USA", "JPN"]) {
    const b = byCountry[id];
    const total = b && Object.values(b.percentOfGdp).reduce((sum, v) => sum + v, 0);
    console.log(`  ${id}: ${b?.source} ${b?.year}, total ${total?.toFixed(1)}% of GDP, defence ${b?.percentOfGdp.defence}%`);
  }
  writeCache("budget", byCountry);
}

function newestComplete(years: Years): Omit<BudgetEntry, "source"> | null {
  const newest = [...years]
    .filter(([, values]) => BUDGET_FUNCTIONS.every((f) => values[f.id] !== undefined))
    .sort((a, b) => b[0] - a[0])[0];
  return newest === undefined ? null : { year: newest[0], percentOfGdp: newest[1] as Record<BudgetFunctionId, number> };
}

function set(byCountry: Map<string, Years>, id: string, year: number, fn: BudgetFunctionId, value: number): void {
  const years = byCountry.get(id) ?? new Map();
  byCountry.set(id, years);
  const values = years.get(year) ?? {};
  years.set(year, values);
  values[fn] = value;
}

// JSON-stat 2.0: `value` is keyed by the flat index over all dimensions (row-major in `id` order).
interface JsonStat {
  id: string[];
  size: number[];
  dimension: Record<string, { category: { index: Record<string, number> } }>;
  value: Record<string, number>;
}

async function eurostat(): Promise<Map<string, Years>> {
  const functions = BUDGET_FUNCTIONS.map((f) => `&cofog99=${f.cofog}`).join("");
  const url =
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_exp?format=JSON&lang=EN" +
    `&unit=PC_GDP&sector=S13&na_item=TE${functions}&sinceTimePeriod=${lastFullYear() - YEARS_BACK}`;
  const data = await fetchJson<JsonStat>(url, "Eurostat gov_10a_exp");
  const index = (dim: string) => data.dimension[dim].category.index;
  const strides = data.size.map((_, i) => data.size.slice(i + 1).reduce((a, b) => a * b, 1));
  const position = (dim: string) => data.id.indexOf(dim);

  // Eurostat uses ISO 3166 alpha-2 except Greece (EL); aggregates (EU27_2020, EA20) match nothing.
  const fromIso2 = new Map(loadCountries().flatMap((c) => (c.iso2 === null ? [] : [[c.iso2 === "GR" ? "EL" : c.iso2, c.id] as const])));
  const byCountry = new Map<string, Years>();
  for (const f of BUDGET_FUNCTIONS) {
    for (const [geo, g] of Object.entries(index("geo"))) {
      const id = fromIso2.get(geo);
      if (id === undefined) {
        continue;
      }
      for (const [time, t] of Object.entries(index("time"))) {
        const flat =
          index("cofog99")[f.cofog] * strides[position("cofog99")] + g * strides[position("geo")] + t * strides[position("time")];
        const value = data.value[String(flat)];
        if (value !== undefined) {
          set(byCountry, id, Number(time), f.id, value);
        }
      }
    }
  }
  console.log(`  Eurostat: ${byCountry.size} countries, years ${Object.keys(index("time")).join(",")}`);
  return byCountry;
}

// OWID column per function: government_expenditure_by_function__unit_share_gdp__function_<name>__function_subcategory_total
const OWID_NAMES: Record<BudgetFunctionId, string> = {
  social: "social_protection",
  health: "health",
  generalPublic: "general_public_services",
  education: "education",
  economic: "economic_affairs",
  defence: "defense",
  publicOrder: "public_order_and_safety",
  housing: "housing_and_community_amenities",
  recreation: "recreation__culture_and_religion",
  environment: "environmental_protection",
};

async function oecd(): Promise<Map<string, Years>> {
  const slug = "government-spending-by-function-as-share-of-gdp-across-countries";
  const rows = parseCsv(
    await fetchText(`https://ourworldindata.org/grapher/${slug}.csv?v=1&csvType=full&useColumnShortNames=true`, `OWID ${slug}`),
  );
  const columns = Object.keys(rows[0]);
  const column = (fn: BudgetFunctionId) => `government_expenditure_by_function__unit_share_gdp__function_${OWID_NAMES[fn]}__function_subcategory_total`;
  const missing = BUDGET_FUNCTIONS.filter((f) => !columns.includes(column(f.id)));
  if (missing.length > 0) {
    throw new Error(`OWID ${slug}: no column for ${missing.map((f) => f.id).join(", ")}; columns are ${columns.join(", ")}`);
  }
  const ourId = codeMatcher("owid");
  const oldest = lastFullYear() - YEARS_BACK;
  const byCountry = new Map<string, Years>();
  for (const r of rows) {
    const id = ourId.get(r.code);
    if (id === undefined || Number(r.year) < oldest) {
      continue;
    }
    for (const f of BUDGET_FUNCTIONS) {
      if (r[column(f.id)] !== "") {
        set(byCountry, id, Number(r.year), f.id, Number(r[column(f.id)]));
      }
    }
  }
  console.log(`  OECD (OWID): ${byCountry.size} countries`);
  return byCountry;
}
