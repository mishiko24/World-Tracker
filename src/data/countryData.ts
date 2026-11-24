// The per-country data file: public/data/countries/<id>.json
//
// Written by scripts/data/build.ts, read by the info panel. This file is the contract between them;
// both sides import these types, so a change here is checked on both ends.
//
// Every value carries its own year and source, because sources update at different times.
// A missing value is null (never 0), so the UI can show "No data" instead of a misleading zero.

import type { TradeGroupId } from "./trade.ts";

export type SourceId =
  | "worldbank"
  | "wikidata"
  | "factbook"
  | "unwpp"
  | "eia"
  | "usgs"
  | "faostat"
  | "ember"
  | "eurostat"
  | "oecd"
  | "baci";

export interface SourceInfo {
  short: string; // shown next to every value
  name: string; // shown in the tooltip
  url: string;
  license: string; // shown on the Sources & method page (about.html); every source must allow commercial use
}

export const SOURCES: Record<SourceId, SourceInfo> = {
  worldbank: {
    short: "World Bank",
    name: "World Bank",
    url: "https://data.worldbank.org",
    license: "CC BY 4.0",
  },
  wikidata: { short: "Wikidata", name: "Wikidata", url: "https://www.wikidata.org", license: "CC0 (public domain)" },
  factbook: {
    short: "Factbook",
    name: "CIA World Factbook (final edition)",
    url: "https://github.com/factbook/factbook.json",
    license: "Public domain (U.S. government work)",
  },
  unwpp: {
    short: "UN",
    name: "UN World Population Prospects, via Our World in Data",
    url: "https://ourworldindata.org",
    license: "CC BY 3.0 IGO (UN), CC BY 4.0 (Our World in Data)",
  },
  eia: {
    short: "EIA",
    name: "U.S. EIA International Energy Data",
    url: "https://www.eia.gov/international/data/world",
    license: "Public domain (U.S. government work)",
  },
  usgs: {
    short: "USGS",
    name: "USGS Mineral Commodity Summaries",
    url: "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries",
    license: "Public domain (U.S. government work)",
  },
  faostat: {
    short: "FAO",
    name: "FAOSTAT (UN Food and Agriculture Organization)",
    url: "https://www.fao.org/faostat",
    license: "CC BY 4.0",
  },
  ember: {
    short: "Ember",
    name: "Ember & Energy Institute, via Our World in Data",
    url: "https://github.com/owid/energy-data",
    license: "CC BY 4.0 (Ember, Our World in Data); Energy Institute Statistical Review, with attribution",
  },
  eurostat: {
    short: "Eurostat",
    name: "Eurostat, government expenditure by function (gov_10a_exp)",
    url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/default/table",
    license: "Reuse allowed with acknowledgement (Commission Decision 2011/833/EU)",
  },
  oecd: {
    short: "OECD",
    name: "OECD Government at a Glance, via Our World in Data",
    url: "https://ourworldindata.org/government-spending",
    license: "CC BY 4.0",
  },
  baci: {
    short: "CEPII BACI",
    name: "CEPII BACI, international trade by product (UN Comtrade, reconciled)",
    url: "https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37",
    license: "Etalab Open Licence 2.0",
  },
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
  // World Bank WGI "Political Stability and Absence of Violence/Terrorism", 0-100, higher = more stable.
  // Perception-based (expert and survey sources). Also the Power Level stability pillar.
  politicalStability: NumberFact | null;
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
  gdp: NumberFact | null; // current US dollars (all economy figures: World Bank)
  gdpRank: RankFact | null;
  gdpPerCapita: NumberFact | null; // current US dollars
  gdpPerCapitaPpp: NumberFact | null; // international dollars
  growth: NumberFact | null; // real GDP growth, percent
  inflation: NumberFact | null; // consumer prices, annual percent
  debt: NumberFact | null; // central government debt, percent of GDP
  debtUsd: NumberFact | null; // the same debt in current US dollars (debt % × GDP of the debt's year)
  budget: Budget | null; // what the government spends its money on (~40 countries: Europe and OECD)
}

// The 10 divisions of the UN Classification of the Functions of Government (COFOG), in the order a typical
// rich country's budget ranks them. `about` explains the category (tooltips).
export const BUDGET_FUNCTIONS = [
  { id: "social", cofog: "GF10", label: "Social protection", about: "Pensions, unemployment, family, sickness and disability benefits" },
  { id: "health", cofog: "GF07", label: "Health", about: "Hospitals, doctors, medicines and public health" },
  { id: "generalPublic", cofog: "GF01", label: "General public services", about: "Running the government and parliament, interest on public debt, foreign aid, basic research" },
  { id: "education", cofog: "GF09", label: "Education", about: "Schools, universities and training" },
  { id: "economic", cofog: "GF04", label: "Economic affairs", about: "Transport, energy, farming and industry support, job programs" },
  { id: "defence", cofog: "GF02", label: "Defence", about: "Military and civil defence, military aid to other countries" },
  { id: "publicOrder", cofog: "GF03", label: "Public order and safety", about: "Police, fire services, courts and prisons" },
  { id: "housing", cofog: "GF06", label: "Housing and community", about: "Housing, community development, water supply, street lighting" },
  { id: "recreation", cofog: "GF08", label: "Recreation and culture", about: "Sport, culture, broadcasting and religious services" },
  { id: "environment", cofog: "GF05", label: "Environment", about: "Waste, waste water, pollution and nature protection" },
] as const;
export type BudgetFunctionId = (typeof BUDGET_FUNCTIONS)[number]["id"];

// General government spending (central, state, local, social security) by function, one year. Eurostat for
// EU and EFTA countries, OECD (via Our World in Data) for the other OECD members that report it.
export interface Budget {
  year: number;
  source: SourceId;
  percentOfGdp: number; // all spending; the sum of the functions
  totalUsd: number | null; // percentOfGdp × World Bank GDP of the same year
  functions: Record<BudgetFunctionId, number>; // percent of GDP each (can be slightly negative: asset sales)
}

// Goods trade in one year (CEPII BACI: UN Comtrade reconciled between exporters and importers). Services
// (tourism, finance, software) are not included.
export interface Trade {
  year: number;
  source: SourceId;
  exports: number; // US dollars
  imports: number;
  exportsByGroup: Record<TradeGroupId, number>; // US dollars per category (src/data/trade.ts)
  importsByGroup: Record<TradeGroupId, number>;
  topExports: TradeProduct[]; // biggest first
  topImports: TradeProduct[];
  exportPartners: TradePartner[]; // biggest first
  importPartners: TradePartner[];
}

export interface TradeProduct {
  code: string; // HS 2022, 6 digits
  name: string; // short display name
  description: string; // official HS description (tooltip)
  usd: number;
  worldRank: number; // among all exporters of this product (importers, for imports)
  worldShare: number; // percent of world trade in this product
}

export interface TradePartner {
  id: string; // country id
  name: string;
  usd: number;
}

// CIA World Factbook estimates (final edition, 2025). Spending older than the Factbook's newest years is left out
// (Ukraine's last figure is from before the 2022 invasion).
export interface Military {
  spending: NumberFact | null; // percent of GDP
  spendingUsd: NumberFact | null; // spending % × World Bank GDP of the same year
  spendingPerPerson: NumberFact | null; // spendingUsd / population, US dollars
  personnel: Personnel | null;
  personnelPer1000: NumberFact | null; // active personnel per 1,000 people
}

export interface Personnel {
  value: number; // middle of the range, for ranking and comparing
  low: number;
  high: number; // = low when the Factbook gives one number
  year: number;
  source: SourceId;
  note: string; // the Factbook's sentence ("estimated 1.1-1.2 million active Armed Forces; ...")
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
  all: Crop[]; // every product, biggest first; used to compare with another country's lists
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

// Power Level: World Tracker's own index (method: scripts/data/powerLevel.ts). Scores are 0-100.
export type PillarId = "economy" | "resources" | "population" | "energy" | "food" | "stability";

// Pillar weights in the total score (sum 1). Used by the pipeline (scripts/data/powerLevel.ts) and shown on the
// Sources & method page, so the page can't drift from the formula.
export const PILLAR_WEIGHTS: Record<PillarId, number> = {
  economy: 0.4,
  resources: 0.15,
  population: 0.15,
  energy: 0.15,
  food: 0.1,
  stability: 0.05,
};

// Written by the pipeline next to summary.json: when the data was built.
export interface DataMeta {
  builtAt: string; // YYYY-MM-DD
  powerLevelVersion: number;
  countries: number; // countries on the map
  scored: number; // countries with a Power Level
  resources: ResourceInfo[]; // the resources that get list-view columns, in column order
}

// A resource as a list-view column: its unit, or null when too few countries have that number to be worth a column.
export interface ResourceInfo {
  id: string;
  name: string;
  category: "energy" | "mineral";
  production: AmountUnit | null;
  reserves: AmountUnit | null;
}

// The world's staple foods: one list-view column each. name = the FAOSTAT item name.
export const STAPLES = [
  { id: "maize", name: "Maize (corn)", label: "Maize" },
  { id: "wheat", name: "Wheat", label: "Wheat" },
  { id: "rice", name: "Rice", label: "Rice" },
  { id: "soybeans", name: "Soya beans", label: "Soybeans" },
  { id: "potatoes", name: "Potatoes", label: "Potatoes" },
  { id: "cassava", name: "Cassava", label: "Cassava" },
  { id: "sugar-cane", name: "Sugar cane", label: "Sugar cane" },
  { id: "bananas", name: "Bananas", label: "Bananas" },
  { id: "palm-oil", name: "Oil palm fruit", label: "Oil palm fruit" },
  { id: "coffee", name: "Coffee, green", label: "Coffee" },
  { id: "milk", name: "Raw milk of cattle", label: "Milk" },
  { id: "beef", name: "Meat of cattle", label: "Beef" },
  { id: "chicken", name: "Meat of chickens", label: "Chicken" },
  { id: "pork", name: "Meat of pig", label: "Pork" },
  { id: "eggs", name: "Hen eggs in shell", label: "Eggs" },
] as const;
export type StapleId = (typeof STAPLES)[number]["id"];

// Display order and names (info panel, share cards).
export const PILLAR_ORDER: PillarId[] = ["economy", "resources", "population", "energy", "food", "stability"];
export const PILLAR_LABELS: Record<PillarId, string> = {
  economy: "Economy",
  resources: "Resources",
  population: "Population",
  energy: "Energy",
  food: "Food",
  stability: "Stability",
};

export interface PowerLevel {
  version: number;
  score: number;
  rank: number; // 1 = most powerful
  of: number; // countries with a score
  pillars: Record<PillarId, number | null>; // null = no data for that pillar
}

export interface CountryData {
  id: string;
  name: string;
  builtAt: string; // ISO date the file was generated
  powerLevel: PowerLevel | null; // null = insufficient data
  government: Government;
  population: Population;
  economy: Economy;
  military: Military;
  trade: Trade | null;
  resources: Resource[]; // same list feeds both the Production and Reserves tabs
  agriculture: Agriculture | null;
  power: Power;
  trends: Trends; // yearly history of some numbers, for the trend charts
}

// Yearly values since TRENDS_FROM_YEAR (World Bank; military spending: Factbook), oldest first. A missing key = no history for that number.
export type TrendKey =
  | "population"
  | "lifeExpectancy"
  | "fertility"
  | "gdp"
  | "gdpPerCapita"
  | "gdpPerCapitaPpp"
  | "growth"
  | "inflation"
  | "electricityAccess"
  | "militarySpending"; // % of GDP, Factbook (from 2017 at most)
export type TrendPoint = [year: number, value: number];
export type Trends = Partial<Record<TrendKey, TrendPoint[]>>;

// One row of the list view: public/data/summary.json is an array of these, one per map country.
// Plain numbers (no year/source) to keep the file small; the info panel has the details.
// To add a list column: add a field here, fill it in scripts/data/build.ts (summaryOf), add it to src/ui/list/columns.ts.
export interface CountrySummary {
  id: string;
  name: string;
  powerLevel: number | null;
  population: number | null;
  fertility: number | null;
  lifeExpectancy: number | null;
  medianAge: number | null;
  density: number | null;
  gdp: number | null;
  gdpPerCapita: number | null;
  gdpPerCapitaPpp: number | null;
  growth: number | null;
  inflation: number | null;
  debtUsd: number | null;
  debtPercent: number | null;
  politicalStability: number | null; // 0-100
  govSpending: number | null; // all government spending, % of GDP
  budget: Partial<Record<BudgetFunctionId, number>>; // share of government spending, %
  exports: number | null; // goods, US dollars
  imports: number | null;
  tradeBalance: number | null; // exports - imports
  exportGroups: Partial<Record<TradeGroupId, number>>; // share of goods exports, %
  militarySpending: number | null; // % of GDP
  militarySpendingUsd: number | null;
  militaryPerPerson: number | null; // spending per person, US dollars
  militaryPersonnel: number | null; // active, middle of the Factbook's range
  militaryPerThousand: number | null; // active personnel per 1,000 people
  electricityTwh: number | null; // electricity generated per year
  electricityAccess: number | null; // % of population
  pillars: Record<PillarId, number | null> | null; // Power Level pillar scores; null = no Power Level
  governmentType: string | null;
  rulingParty: string | null;
  headOfState: string | null;
  headOfGovernment: string | null;
  under15: number | null; // % of population
  from15to64: number | null;
  over65: number | null;
  production: Record<string, number>; // resource id -> production per year, unit in DataMeta.resources
  reserves: Record<string, number>;
  crops: Partial<Record<StapleId, number>>; // tonnes per year
  generation: Partial<Record<PowerSource, number>>; // TWh per year by source
}

// The summary fields that hold a single number (list columns, audit).
export type SummaryNumberKey = {
  [K in keyof CountrySummary]: CountrySummary[K] extends number | null ? K : never;
}[keyof CountrySummary];
