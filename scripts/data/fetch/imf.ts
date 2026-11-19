// IMF DataMapper API (World Economic Outlook, no key). Headline economy numbers.
// WEO includes projections for future years; we use the last full calendar year (an IMF estimate
// for some countries), falling back to the latest earlier year that has a value.

import { codeMatcher } from "../lib/countries.ts";
import { fetchJson, lastFullYear, writeCache } from "../lib/io.ts";

const INDICATORS = {
  gdpBillions: "NGDPD", // billions of US dollars
  gdpPerCapita: "NGDPDPC",
  gdpPerCapitaPpp: "PPPPC",
  growth: "NGDP_RPCH",
  inflation: "PCPIPCH",
  debt: "GGXWDG_NGDP",
  populationMillions: "LP", // fallback when the World Bank has no population (e.g. Taiwan)
} as const;

export type ImfField = keyof typeof INDICATORS;
export type ImfEntry = Partial<Record<ImfField, { value: number; year: number }>>;

interface ApiResponse {
  values?: Record<string, Record<string, Record<string, number>>>;
}

export async function fetchImf(): Promise<void> {
  const ourId = codeMatcher("imf");
  const targetYear = lastFullYear();
  const byCountry: Record<string, ImfEntry> = {};

  for (const [field, code] of Object.entries(INDICATORS) as [ImfField, string][]) {
    const response = await fetchJson<ApiResponse>(`https://www.imf.org/external/datamapper/api/v1/${code}`, `IMF ${code}`);
    const series = response.values?.[code];
    if (series === undefined) {
      throw new Error(`IMF ${code}: no values in response`);
    }
    let matched = 0;
    for (const [imfCode, byYear] of Object.entries(series)) {
      const id = ourId.get(imfCode);
      if (id === undefined) {
        continue; // region or group aggregate
      }
      const years = Object.keys(byYear).map(Number).filter((y) => y <= targetYear).sort((a, b) => b - a);
      if (years.length === 0) {
        continue;
      }
      byCountry[id] ??= {};
      byCountry[id][field] = { value: byYear[String(years[0])], year: years[0] };
      matched++;
    }
    console.log(`  ${code}: ${matched} countries`);
  }

  writeCache("imf", byCountry);
}
