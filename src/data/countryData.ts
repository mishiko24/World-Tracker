// The per-country data file: public/data/countries/<id>.json
//
// Written by scripts/data/build.ts, read by the info panel. This file is the contract between them;
// both sides import these types, so a change here is checked on both ends.
//
// Every value carries its own year and source, because sources update at different times.
// A missing value is null (never 0), so the UI can show "No data" instead of a misleading zero.

export type SourceId =
  | "worldbank"
  | "imf"
  | "wikidata"
  | "factbook"
  | "unwpp"
  | "eia"
  | "usgs"
  | "faostat"
  | "ember";

export interface SourceInfo {
  short: string; // shown next to every value
  name: string; // shown in the tooltip
  url: string;
}

export const SOURCES: Record<SourceId, SourceInfo> = {
  worldbank: { short: "World Bank", name: "World Bank", url: "https://data.worldbank.org" },
  imf: { short: "IMF", name: "IMF World Economic Outlook", url: "https://www.imf.org/external/datamapper" },
  wikidata: { short: "Wikidata", name: "Wikidata", url: "https://www.wikidata.org" },
  factbook: { short: "Factbook", name: "CIA World Factbook (final edition)", url: "https://github.com/factbook/factbook.json" },
  unwpp: { short: "UN", name: "UN World Population Prospects, via Our World in Data", url: "https://ourworldindata.org" },
  eia: { short: "EIA", name: "U.S. EIA International Energy Data", url: "https://www.eia.gov/international/data/world" },
  usgs: { short: "USGS", name: "USGS Mineral Commodity Summaries", url: "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries" },
  faostat: { short: "FAO", name: "FAOSTAT (UN Food and Agriculture Organization)", url: "https://www.fao.org/faostat" },
  ember: { short: "Ember", name: "Ember & Energy Institute, via Our World in Data", url: "https://github.com/owid/energy-data" },
};

export interface NumberFact {
  value: number;
  year: number;
  source: SourceId;
}

export interface TextFact {
  value: string;
  source: SourceId;
}

export interface RankFact {
  rank: number; // 1 = largest
  of: number; // number of countries ranked
  year: number;
  source: SourceId;
}

export interface Government {
  type: TextFact | null;
  rulingParty: TextFact | null; // party of the head of government, or of the head of state if the former has none
  headOfState: TextFact | null;
  headOfGovernment: TextFact | null;
}

export interface AgeStructure {
  under15: number; // percent of population
  from15to64: number;
  over65: number;
  year: number;
  source: SourceId;
}

export interface Population {
  total: NumberFact | null;
  density: NumberFact | null; // people per km²
  fertility: NumberFact | null; // children per woman
  lifeExpectancy: NumberFact | null; // years at birth
  medianAge: NumberFact | null; // years
  ageStructure: AgeStructure | null;
}

export interface Economy {
  gdp: NumberFact | null; // current US dollars
  gdpRank: RankFact | null;
  gdpPerCapita: NumberFact | null; // current US dollars
  gdpPerCapitaPpp: NumberFact | null; // international dollars
  growth: NumberFact | null; // real GDP growth, percent
  inflation: NumberFact | null; // average consumer prices, percent
  debt: NumberFact | null; // general government gross debt, percent of GDP
}

// Units are canonical so the UI can format them: production per year (oil per day, as quoted worldwide).
export type AmountUnit = "bbl/day" | "bbl" | "m³" | "m³/year" | "t" | "t/year" | "kg" | "kg/year" | "carats" | "carats/year";

export interface Amount {
  value: number;
  unit: AmountUnit;
  year: number;
  source: SourceId;
  worldRank: number | null;
  worldShare: number | null; // 0..1
}

export interface Resource {
  id: string; // stable key, e.g. "oil", "copper"
  name: string;
  category: "energy" | "mineral";
  production: Amount | null;
  reserves: Amount | null;
}

export interface Crop {
  name: string;
  tonnes: number;
  worldRank: number;
  worldShare: number; // 0..1
}

export interface Agriculture {
  year: number;
  source: SourceId;
  largest: Crop[]; // biggest products by tonnage
  worldLeading: Crop[]; // products where the country is a world top-10 producer, best rank first
}

export type PowerSource = "coal" | "gas" | "oil" | "nuclear" | "hydro" | "wind" | "solar" | "bioenergy" | "other";

export interface Generation {
  year: number;
  source: SourceId;
  totalTwh: number;
  mix: { source: PowerSource; twh: number }[]; // sums to totalTwh, largest first, zero sources left out
}

export interface Power {
  generation: Generation | null;
  electricityAccess: NumberFact | null; // percent of population
}

export interface CountryData {
  id: string;
  name: string;
  builtAt: string; // ISO date the file was generated
  government: Government;
  population: Population;
  economy: Economy;
  resources: Resource[]; // same list feeds both the Production and Reserves tabs
  agriculture: Agriculture | null;
  power: Power;
}
