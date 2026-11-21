// World Bank Indicators API (no key, CC BY 4.0, commercial use allowed with attribution).
// Population, economy, access to electricity and political stability (Worldwide Governance Indicators).
// `mrnev=1` returns each country's most recent non-empty value, so years can differ per country.
// For the TREND_FIELDS the latest value is taken from the full history instead (mrnev=1 has dropped values).
//
// Economy used to come from the IMF, whose terms forbid systematic downloading and commercial reuse
// without written permission. Debt here is *central* government debt (IMF GFS via the World Bank),
// which covers fewer countries and lags more than the IMF's general government debt.

import type { TrendKey, TrendPoint } from "../../../src/data/countryData.ts";
import { codeMatcher } from "../lib/countries.ts";
import { fetchJson, writeCache } from "../lib/io.ts";

const INDICATORS = {
  population: "SP.POP.TOTL",
  density: "EN.POP.DNST",
  fertility: "SP.DYN.TFRT.IN",
  lifeExpectancy: "SP.DYN.LE00.IN",
  under15: "SP.POP.0014.TO.ZS",
  from15to64: "SP.POP.1564.TO.ZS",
  over65: "SP.POP.65UP.TO.ZS",
  electricityAccess: "EG.ELC.ACCS.ZS",
  gdp: "NY.GDP.MKTP.CD", // current US$
  gdpPerCapita: "NY.GDP.PCAP.CD", // current US$
  gdpPerCapitaPpp: "NY.GDP.PCAP.PP.CD", // current international $
  growth: "NY.GDP.MKTP.KD.ZG", // real GDP growth, %
  inflation: "FP.CPI.TOTL.ZG", // consumer prices, annual %
  debt: "GC.DOD.TOTL.GD.ZS", // central government debt, % of GDP
  politicalStability: "GOV_WGI_PV_SC", // WGI "Political Stability and Absence of Violence/Terrorism", score 0-100
} as const;

const GDP_HISTORY_YEARS = 15; // debt is often years older than GDP; dollars = debt % × GDP of the debt's year

// History for the trend charts: these indicators, every year from TRENDS_FROM_YEAR.
const TRENDS_FROM_YEAR = 2000;
const TREND_FIELDS: TrendKey[] = [
  "population",
  "lifeExpectancy",
  "fertility",
  "gdp",
  "gdpPerCapita",
  "gdpPerCapitaPpp",
  "growth",
  "inflation",
  "electricityAccess",
];

export type WorldBankField = keyof typeof INDICATORS;
export type WorldBankEntry = Partial<Record<WorldBankField, { value: number; year: number }>> & {
  gdpByYear?: Record<string, number>;
  trends?: Partial<Record<TrendKey, TrendPoint[]>>; // oldest first
};

interface ApiRow {
  countryiso3code: string;
  date: string;
  value: number | null;
}

export async function fetchWorldBank(): Promise<void> {
  const ourId = codeMatcher("worldbank");
  const byCountry: Record<string, WorldBankEntry> = {};

  for (const [field, code] of Object.entries(INDICATORS) as [WorldBankField, string][]) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=1000&mrnev=1`;
    const [meta, rows] = await fetchJson<[{ pages: number }, ApiRow[]]>(url, `World Bank ${code}`);
    if (meta.pages !== 1) {
      throw new Error(`World Bank ${code}: expected 1 page, got ${meta.pages}`);
    }
    let matched = 0;
    for (const row of rows) {
      const id = ourId.get(row.countryiso3code);
      if (id === undefined || row.value === null) {
        continue;
      }
      byCountry[id] ??= {};
      byCountry[id][field] = { value: row.value, year: Number(row.date) };
      matched++;
    }
    console.log(`  ${code}: ${matched} countries`);
  }

  // GDP history, for converting debt % of GDP into dollars at the debt's own year.
  const historyUrl = `https://api.worldbank.org/v2/country/all/indicator/${INDICATORS.gdp}?format=json&per_page=20000&mrv=${GDP_HISTORY_YEARS}`;
  const [historyMeta, historyRows] = await fetchJson<[{ pages: number }, ApiRow[]]>(historyUrl, "World Bank GDP history");
  if (historyMeta.pages !== 1) {
    throw new Error(`World Bank GDP history: expected 1 page, got ${historyMeta.pages}`);
  }
  for (const row of historyRows) {
    const id = ourId.get(row.countryiso3code);
    if (id === undefined || row.value === null) {
      continue;
    }
    byCountry[id] ??= {};
    byCountry[id].gdpByYear ??= {};
    byCountry[id].gdpByYear![row.date] = row.value;
  }

  // Trend history: one request per indicator, all countries, every year since TRENDS_FROM_YEAR.
  const thisYear = new Date().getUTCFullYear();
  for (const field of TREND_FIELDS) {
    const code = INDICATORS[field];
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=20000&date=${TRENDS_FROM_YEAR}:${thisYear}`;
    const [meta, rows] = await fetchJson<[{ pages: number }, ApiRow[]]>(url, `World Bank ${code} history`);
    if (meta.pages !== 1) {
      throw new Error(`World Bank ${code} history: expected 1 page, got ${meta.pages}`);
    }
    let series = 0;
    for (const row of rows) {
      const id = ourId.get(row.countryiso3code);
      if (id === undefined || row.value === null) {
        continue;
      }
      byCountry[id] ??= {};
      byCountry[id].trends ??= {};
      const points = (byCountry[id].trends![field] ??= []);
      if (points.length === 0) {
        series++;
      }
      points.push([Number(row.date), row.value]);
    }
    for (const entry of Object.values(byCountry)) {
      const points = entry.trends?.[field];
      if (points === undefined) {
        continue;
      }
      points.sort((p, q) => p[0] - q[0]); // the API lists newest first
      // The latest value comes from the history too: `mrnev=1` silently dropped inflation for 16 countries
      // (US, Argentina, Qatar...) in Nov 2026 while their history had 2024.
      const [year, value] = points[points.length - 1];
      entry[field] = { value, year };
    }
    console.log(`  ${code} history: ${series} countries`);
  }

  writeCache("worldbank", byCountry);
}
