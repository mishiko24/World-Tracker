// Power Level v2: World Tracker's own 0-100 index of a country's weight in the world.
// Computed from all countries at once in build.ts, because every indicator is scaled relative to the world.
//
// Pillars (weights) and indicators (weights inside the pillar):
//   economy    40%  GDP 0.4, total GDP at PPP 0.25, GDP per capita at PPP 0.15,
//                   real growth 0.1, inflation 0.05 (closer to 2% is better), government debt 0.05 (lower is better)
//   resources  15%  importance-weighted world shares of production (0.6) and reserves (0.4)
//   population 15%  population 0.6, working-age share 0.2, life expectancy 0.2
//   energy     15%  electricity generation 0.7, generation per person 0.3
//   food       10%  importance-weighted world shares of staple food production
//   stability   5%  World Bank WGI political stability score (0-100), nothing else
//
// v1 -> v2 (Nov 2026): stability was debt + inflation, which ranked Russia above the US and rewarded countries
// with no debt data. Economic indicators now all sit in the economy pillar.
//
// Scaling: every indicator becomes 0..1 across all countries.
//   totals (GDP, population, TWh)   (value / max) ^ 0.3   keeps gaps between big countries visible
//                                   (a log scale made Japan's 13x bigger GDP than Chile's look like 84 vs 68)
//   per person (GDP/capita, kWh)    log scale between the lowest and highest country
//   world shares (resources, food)  sqrt(value / max)
// A missing indicator's weight goes to the others in its
// pillar; a missing pillar's weight goes to the other pillars. No resources = 0 (USGS/EIA list every notable
// producer), but no energy or food data = unknown. Without economy and population data there is no score.
//
// Change anything here = new version number, and update the method text in src/about/AboutPage.tsx.
// Pillar weights live in src/data/countryData.ts (PILLAR_WEIGHTS), shared with that page.

import { PILLAR_WEIGHTS, type CountryData, type PillarId, type PowerLevel } from "../../src/data/countryData.ts";

export const POWER_LEVEL_VERSION = 2;

// Fixed ranges (not relative to the world), so one outlier like 200% inflation doesn't squash everyone else.
const growthScore = (g: number) => clamp01((g + 5) / 13); // -5% or worse = 0, +8% or better = 1
const inflationScore = (i: number) => 1 - clamp01(Math.abs(i - 2) / 30); // 2% = 1, 32% or -28% = 0
const debtScore = (debtPercentOfGdp: number) =>
  1 - clamp01(debtPercentOfGdp / 200); // 0% = 1, 200%+ = 0

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}


// Strategic weight per resource id; resources not listed (sand, clays, gypsum...) don't count.
const RESOURCE_WEIGHTS: Record<string, number> = {
  oil: 3,
  gas: 3,
  coal: 2,
  // critical minerals
  lithium: 2,
  cobalt: 2,
  "rare-earths": 2,
  nickel: 2,
  copper: 2,
  "graphite-natural": 2,
  "platinum-group-metals": 2,
  manganese: 2,
  tungsten: 2,
  antimony: 2,
  vanadium: 2,
  "niobium-columbium": 2,
  tantalum: 2,
  "titanium-mineral-concentrates": 2,
  molybdenum: 2,
  // major industrial and precious
  "iron-ore": 1,
  bauxite: 1,
  zinc: 1,
  lead: 1,
  tin: 1,
  chromium: 1,
  potash: 1,
  "phosphate-rock": 1,
  gold: 1,
  silver: 1,
};

// FAOSTAT product names (as cleaned by fetch/faostat.ts) -> weight.
const FOOD_WEIGHTS: Record<string, number> = {
  Wheat: 3,
  Rice: 3,
  "Maize (corn)": 3,
  "Soya beans": 2,
  Potatoes: 1,
  Barley: 1,
  Cassava: 1,
  "Sugar cane": 1,
  "Raw milk of cattle": 1,
  "Meat of cattle": 1,
  "Meat of pig": 1,
  "Meat of chickens": 1,
  "Hen eggs in shell": 1,
};

type Indicator = { value: number | null; weight: number };

const SIZE_EXPONENT = 0.3;

// Totals: (v / max) ^ 0.3.
function sizeScaler(
  values: (number | null)[],
): (v: number | null) => number | null {
  const max = Math.max(...values.filter((v): v is number => v !== null));
  return (v) =>
    v === null || v <= 0 ? null : Math.pow(v / max, SIZE_EXPONENT);
}

// Maps raw values to 0..1 between the lowest and highest country: logarithmic or linear.
function scaler(
  values: (number | null)[],
  kind: "log" | "linear",
): (v: number | null) => number | null {
  const transform = (v: number) => (kind === "log" ? Math.log(v) : v);
  const usable = values
    .filter((v): v is number => v !== null && (kind === "linear" || v > 0))
    .map(transform);
  const min = Math.min(...usable);
  const max = Math.max(...usable);
  return (v) => {
    if (v === null || (kind === "log" && v <= 0)) {
      return null;
    }
    return max === min ? 1 : (transform(v) - min) / (max - min);
  };
}

// Weighted average of the available indicators, or null if none is available.
function combine(indicators: Indicator[]): number | null {
  const available = indicators.filter((i) => i.value !== null);
  const totalWeight = available.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) {
    return null;
  }
  return (
    available.reduce((sum, i) => sum + i.value! * i.weight, 0) / totalWeight
  );
}

function resourceRaw(d: CountryData): number {
  let sum = 0;
  for (const r of d.resources) {
    const weight = RESOURCE_WEIGHTS[r.id] ?? 0;
    sum +=
      weight *
      (0.6 * (r.production?.worldShare ?? 0) +
        0.4 * (r.reserves?.worldShare ?? 0));
  }
  return sum;
}

function foodRaw(d: CountryData): number | null {
  if (d.agriculture === null) {
    return null;
  }
  let sum = 0;
  for (const crop of d.agriculture.all) {
    sum += (FOOD_WEIGHTS[crop.name] ?? 0) * crop.worldShare;
  }
  return sum;
}

// World shares: sqrt(v / max).
function shareScaler(
  values: (number | null)[],
): (v: number | null) => number | null {
  const max = Math.max(...values.filter((v): v is number => v !== null));
  return (v) => (v === null ? null : Math.sqrt(v / max));
}

export function computePowerLevels(
  all: CountryData[],
): Map<string, PowerLevel> {
  const pop = (d: CountryData) => d.population.total?.value ?? null;
  const gdpPppTotal = (d: CountryData) => {
    const perCapita = d.economy.gdpPerCapitaPpp?.value;
    const people = pop(d);
    return perCapita !== undefined && people !== null
      ? perCapita * people
      : null;
  };
  const twh = (d: CountryData) => d.power.generation?.totalTwh ?? null;
  const kwhPerPerson = (d: CountryData) => {
    const total = twh(d);
    const people = pop(d);
    return total !== null && people !== null && people > 0
      ? (total * 1e9) / people
      : null;
  };

  const s = {
    gdp: sizeScaler(all.map((d) => d.economy.gdp?.value ?? null)),
    gdpPpp: sizeScaler(all.map(gdpPppTotal)),
    gdpPerCapitaPpp: scaler(
      all.map((d) => d.economy.gdpPerCapitaPpp?.value ?? null),
      "log",
    ),
    population: sizeScaler(all.map(pop)),
    workingAge: scaler(
      all.map((d) => d.population.ageStructure?.from15to64 ?? null),
      "linear",
    ),
    lifeExpectancy: scaler(
      all.map((d) => d.population.lifeExpectancy?.value ?? null),
      "linear",
    ),
    twh: sizeScaler(all.map(twh)),
    kwhPerPerson: scaler(all.map(kwhPerPerson), "log"),
    resources: shareScaler(all.map(resourceRaw)),
    food: shareScaler(all.map(foodRaw)),
  };

  const scores = new Map<
    string,
    { score: number; pillars: Record<PillarId, number | null> }
  >();
  for (const d of all) {
    const e = d.economy;
    const stability = d.government.politicalStability;
    const pillars: Record<PillarId, number | null> = {
      // No GDP figures = no economy pillar (growth/inflation/debt alone don't describe an economy's size).
      economy:
        e.gdp === null && e.gdpPerCapitaPpp === null
          ? null
          : combine([
              { value: s.gdp(e.gdp?.value ?? null), weight: 0.4 },
              { value: s.gdpPpp(gdpPppTotal(d)), weight: 0.25 },
              {
                value: s.gdpPerCapitaPpp(e.gdpPerCapitaPpp?.value ?? null),
                weight: 0.15,
              },
              {
                value: e.growth === null ? null : growthScore(e.growth.value),
                weight: 0.1,
              },
              {
                value:
                  e.inflation === null
                    ? null
                    : inflationScore(e.inflation.value),
                weight: 0.05,
              },
              {
                value: e.debt === null ? null : debtScore(e.debt.value),
                weight: 0.05,
              },
            ]),
      resources: s.resources(resourceRaw(d)),
      population: combine([
        { value: s.population(pop(d)), weight: 0.6 },
        {
          value: s.workingAge(d.population.ageStructure?.from15to64 ?? null),
          weight: 0.2,
        },
        {
          value: s.lifeExpectancy(d.population.lifeExpectancy?.value ?? null),
          weight: 0.2,
        },
      ]),
      energy: combine([
        { value: s.twh(twh(d)), weight: 0.7 },
        { value: s.kwhPerPerson(kwhPerPerson(d)), weight: 0.3 },
      ]),
      food: s.food(foodRaw(d)),
      stability: stability === null ? null : stability.value / 100,
    };
    if (pillars.economy === null || pillars.population === null) {
      continue; // insufficient data
    }
    const total = combine(
      (Object.keys(PILLAR_WEIGHTS) as PillarId[]).map((p) => ({
        value: pillars[p],
        weight: PILLAR_WEIGHTS[p],
      })),
    )!;
    const rounded = Object.fromEntries(
      Object.entries(pillars).map(([p, v]) => [
        p,
        v === null ? null : Math.round(v * 1000) / 10,
      ]),
    ) as Record<PillarId, number | null>;
    scores.set(d.id, {
      score: Math.round(total * 1000) / 10,
      pillars: rounded,
    });
  }

  const ranked = [...scores.values()].map((v) => v.score);
  const result = new Map<string, PowerLevel>();
  for (const [id, { score, pillars }] of scores) {
    result.set(id, {
      version: POWER_LEVEL_VERSION,
      score,
      rank: 1 + ranked.filter((other) => other > score).length,
      of: ranked.length,
      pillars,
    });
  }
  return result;
}
