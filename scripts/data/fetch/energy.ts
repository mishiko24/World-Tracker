// Electricity generation mix: Our World in Data energy dataset on GitHub (CC BY), which combines
// Ember (yearly, most countries up to the last full year) and the Energy Institute Statistical Review.
// The nine source columns add up exactly to electricity_generation.

import type { PowerSource } from "../../../src/data/countryData.ts";
import { codeMatcher } from "../lib/countries.ts";
import { parseCsv } from "../lib/csv.ts";
import { fetchText, writeCache } from "../lib/io.ts";

const URL = "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv";

const SOURCE_COLUMNS: Record<PowerSource, string> = {
  coal: "coal_electricity",
  gas: "gas_electricity",
  oil: "oil_electricity",
  nuclear: "nuclear_electricity",
  hydro: "hydro_electricity",
  wind: "wind_electricity",
  solar: "solar_electricity",
  bioenergy: "biofuel_electricity",
  other: "other_renewable_exc_biofuel_electricity", // mostly geothermal
};

export interface EnergyEntry {
  year: number;
  totalTwh: number;
  mixTwh: Partial<Record<PowerSource, number>>;
}

export async function fetchEnergy(): Promise<void> {
  const ourId = codeMatcher("owid");
  const rows = parseCsv(await fetchText(URL, "OWID energy data"));
  const byCountry: Record<string, EnergyEntry> = {};

  for (const row of rows) {
    const id = ourId.get(row.iso_code);
    if (id === undefined || row.electricity_generation === "") {
      continue;
    }
    const year = Number(row.year);
    if (byCountry[id] !== undefined && byCountry[id].year >= year) {
      continue;
    }
    const mixTwh: Partial<Record<PowerSource, number>> = {};
    for (const [source, column] of Object.entries(SOURCE_COLUMNS) as [PowerSource, string][]) {
      if (row[column] !== "") {
        mixTwh[source] = Number(row[column]);
      }
    }
    byCountry[id] = { year, totalTwh: Number(row.electricity_generation), mixTwh };
  }

  writeCache("energy", byCountry);
}
