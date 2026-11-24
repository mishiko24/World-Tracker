// What each metric means, shown when hovering (or focusing) its label in the info panel and the list headers.
// Keyed by the label as shown in the info panel. Rows with names from the data (crops, resources, power
// sources, budget functions) build their hint from the helpers below.

import type { AmountUnit } from "../../data/countryData";

export const METRIC_HINTS: Record<string, string> = {
  // Government
  "Government type": "How the country is governed, as the CIA World Factbook describes it.",
  "Ruling party": "The party (or parties) holding power in government.",
  "Head of state": "The country's formal leader: a monarch or president.",
  "Head of government": "The leader who runs the government: often a prime minister; in presidential systems, the president.",
  "Political stability":
    "World Bank estimate of how likely the government is to be destabilized or overthrown, including by violence and terrorism. 0 = least stable country, 100 = most stable.",
  // Population
  Population: "People living in the country (mid-year estimate).",
  "Population density": "People per square kilometre of land.",
  "Children per woman": "Fertility rate: children a woman would have in her lifetime at today's rates. About 2.1 keeps a population stable.",
  "Life expectancy": "Years a newborn would live on average if today's death rates stayed the same.",
  "Median age": "Half the population is younger than this, half older.",
  "Age 0–14": "Share of the population aged 0 to 14.",
  "Age 15–64": "Share of the population aged 15 to 64 (working age).",
  "Age 65+": "Share of the population aged 65 and over.",
  // Economy
  GDP: "Gross domestic product: the value of everything the country produces in a year, in US dollars. bn = billion, tn = trillion.",
  "GDP per capita": "GDP divided by the population: average output per person, in US dollars.",
  "GDP per capita (PPP)":
    "GDP per person adjusted for what money buys locally (purchasing power parity), in international dollars. Better than plain GDP per capita for comparing living standards.",
  "Real growth": "How much the economy grew last year, after removing inflation.",
  Inflation: "How much consumer prices rose in a year.",
  "Central gov. debt": "Money the central (national) government owes, in US dollars. Excludes state and local government.",
  "Debt, % of GDP": "Central government debt as a share of GDP: how big the debt is next to the economy.",
  "Government spending":
    "Everything the government spends in a year (central, state and local government and social security funds), in US dollars and as a share of GDP.",
  "Spending, % of GDP": "All government spending as a share of GDP.",
  // Military
  "Military spending": "Defence spending in a year, in US dollars: the Factbook's share of GDP times GDP.",
  "Per person": "Military spending divided by the population, in US dollars.",
  "Share of GDP": "Military spending as a share of GDP (CIA World Factbook estimate).",
  "Active personnel":
    "Active-duty military personnel (CIA World Factbook estimate). Some countries are given as a range; comparisons use its middle.",
  "Per 1,000 people": "Active military personnel for every 1,000 people living in the country.",
  // Trade
  Exports: "Goods the country sold abroad in a year, in US dollars (CEPII BACI). Services such as tourism and software are not included.",
  Imports: "Goods the country bought from abroad in a year, in US dollars. Services are not included.",
  "Trade balance": "Goods exports minus goods imports: + is a surplus (sells more than it buys), − a deficit.",
  // Power
  "Total generation": "Electricity produced in a year. TWh = terawatt-hours (a billion kilowatt-hours).",
  Total: "Electricity produced in a year. TWh = terawatt-hours (a billion kilowatt-hours).",
  "Access to electricity": "Share of the population with access to electricity.",
};

// List column labels that differ from the panel's.
const ALIASES: Record<string, string> = {
  Density: "Population density",
  "Births per woman": "Children per woman",
  "Central gov. debt (% GDP)": "Debt, % of GDP",
  "Spending per person": "Per person",
  "Military spending (% GDP)": "Share of GDP",
  "Personnel per 1,000": "Per 1,000 people",
  "Electricity generated": "Total generation",
  "Gov. spending": "Spending, % of GDP",
  "Under 15": "Age 0–14",
  "15–64": "Age 15–64",
  "65 and over": "Age 65+",
};
for (const [alias, label] of Object.entries(ALIASES)) {
  METRIC_HINTS[alias] = METRIC_HINTS[label];
}

// "Mt" and friends, spelled out.
const TONNES = "t = tonnes, kt = thousand tonnes, Mt = million tonnes, Gt = billion tonnes";

export function cropHint(name: string): string {
  return `${name}: how much the country produces in a year (${TONNES}). "#3 world" = world rank; the % is its share of world production.`;
}

const UNIT_HINTS: Record<AmountUnit, string> = {
  "bbl/day": "barrels per day (1 barrel = 159 litres)",
  bbl: "barrels (1 barrel = 159 litres)",
  "m³/year": "cubic metres per year",
  "m³": "cubic metres",
  "t/year": `per year; ${TONNES}`,
  t: TONNES,
  "kg/year": `per year; kg = kilograms, ${TONNES}`,
  kg: `kg = kilograms, ${TONNES}`,
  "carats/year": "carats per year (1 carat = 0.2 grams)",
  carats: "carats (1 carat = 0.2 grams)",
};

export function resourceHint(name: string, kind: "production" | "reserves", unit: AmountUnit): string {
  const what = kind === "production" ? "how much the country produces" : "proved reserves: how much is known to be in the ground and recoverable";
  return `${name}: ${what}. Unit: ${UNIT_HINTS[unit]}. "#3 world" = world rank; the % is its share of the world total.`;
}

export function powerSourceHint(source: string): string {
  return `Electricity from ${source.toLowerCase()} in a year. TWh = terawatt-hours (a billion kilowatt-hours); the % is its share of all generation.`;
}
