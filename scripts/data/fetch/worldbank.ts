// World Bank Indicators API (no key, CC BY 4.0, commercial use allowed with attribution).
// Population, economy and access to electricity.
// `mrnev=1` returns each country's most recent non-empty value, so years can differ per country.
//
// Economy used to come from the IMF, whose terms forbid systematic downloading and commercial reuse
// without written permission. Debt here is *central* government debt (IMF GFS via the World Bank),
// which covers fewer countries and lags more than the IMF's general government debt.

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
} as const;

const GDP_HISTORY_YEARS = 15; // debt is often years older than GDP; dollars = debt % × GDP of the debt's year

export type WorldBankField = keyof typeof INDICATORS;
export type WorldBankEntry = Partial<Record<WorldBankField, { value: number; year: number }>> & {
  gdpByYear?: Record<string, number>;
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

  writeCache("worldbank", byCountry);
}
