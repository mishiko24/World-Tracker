// World Bank Indicators API (no key). Population basics and access to electricity.
// `mrnev=1` returns each country's most recent non-empty value, so years can differ per country.

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
} as const;

export type WorldBankField = keyof typeof INDICATORS;
export type WorldBankEntry = Partial<Record<WorldBankField, { value: number; year: number }>>;

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

  writeCache("worldbank", byCountry);
}
