// Merges all data-cache/*.json into public/data/countries/<id>.json (one file per map country)
// and prints a coverage report. No network: re-run any time after editing merge rules.
//
// Fallback order per field is written inline (first non-null wins).

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import type {
  Agriculture,
  Amount,
  CountrySummary,
  CountryData,
  Economy,
  Government,
  NumberFact,
  Population,
  Power,
  PowerSource,
  RankFact,
  Resource,
  SourceId,
  TextFact,
} from "../../src/data/countryData.ts";
import { loadCountries } from "./lib/countries.ts";
import { readCache } from "./lib/io.ts";
import type { EiaEntry } from "./fetch/eia.ts";
import type { FossilReservesEntry } from "./fetch/fossilReserves.ts";
import type { EnergyEntry } from "./fetch/energy.ts";
import type { FactbookEntry } from "./fetch/factbook.ts";
import type { FaoEntry } from "./fetch/faostat.ts";
import type { ImfEntry } from "./fetch/imf.ts";
import type { UnWppEntry } from "./fetch/unwpp.ts";
import type { UsgsEntry } from "./fetch/usgs.ts";
import type { WikidataEntry } from "./fetch/wikidata.ts";
import type { WorldBankEntry } from "./fetch/worldbank.ts";

const OUTPUT_DIR = "public/data/countries";
const SUMMARY_FILE = "public/data/summary.json";

const worldbank = readCache<WorldBankEntry>("worldbank").byCountry;
const imf = readCache<ImfEntry>("imf").byCountry;
const wikidata = readCache<WikidataEntry>("wikidata").byCountry;
const factbook = readCache<FactbookEntry>("factbook").byCountry;
const unwpp = readCache<UnWppEntry>("unwpp").byCountry;
const eia = readCache<EiaEntry>("eia").byCountry;
const fossilReserves = readCache<FossilReservesEntry>("reserves").byCountry;
const usgs = readCache<UsgsEntry>("usgs").byCountry;
const faostat = readCache<FaoEntry>("faostat").byCountry;
const energy = readCache<EnergyEntry>("energy").byCountry;

function fact(entry: { value: number; year: number } | undefined, source: SourceId, scale = 1): NumberFact | null {
  if (entry === undefined) {
    return null;
  }
  return { value: entry.value * scale, year: entry.year, source };
}

function text(value: string | null | undefined, source: SourceId): TextFact | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return { value, source };
}

function buildGovernment(id: string): Government {
  const wd = wikidata[id];
  return {
    type: text(factbook[id]?.governmentType, "factbook"),
    rulingParty: text(wd?.headOfGovernmentParty ?? wd?.headOfStateParty, "wikidata"),
    headOfState: text(wd?.headOfState, "wikidata"),
    headOfGovernment: text(wd?.headOfGovernment, "wikidata"),
  };
}

function buildPopulation(id: string): Population {
  const wb = worldbank[id] ?? {};
  const un = unwpp[id] ?? {};
  const age =
    wb.under15 && wb.from15to64 && wb.over65
      ? { under15: wb.under15.value, from15to64: wb.from15to64.value, over65: wb.over65.value, year: wb.under15.year, source: "worldbank" as const }
      : null;
  return {
    total: fact(wb.population, "worldbank") ?? fact(un.population, "unwpp"),
    density: fact(wb.density, "worldbank"),
    fertility: fact(wb.fertility, "worldbank") ?? fact(un.fertility, "unwpp"),
    lifeExpectancy: fact(wb.lifeExpectancy, "worldbank") ?? fact(un.lifeExpectancy, "unwpp"),
    medianAge: fact(un.medianAge, "unwpp"),
    ageStructure: age,
  };
}

// GDP rank among all countries with an IMF GDP figure for the same year.
function gdpRank(id: string): RankFact | null {
  const own = imf[id]?.gdpBillions;
  if (own === undefined) {
    return null;
  }
  const sameYear = Object.values(imf).map((e) => e.gdpBillions).filter((g) => g !== undefined && g.year === own.year);
  return {
    rank: 1 + sameYear.filter((g) => g!.value > own.value).length,
    of: sameYear.length,
    year: own.year,
    source: "imf",
  };
}

function buildEconomy(id: string): Economy {
  const e = imf[id] ?? {};
  const debtUsd =
    e.debt && e.gdpBillions && e.debt.year === e.gdpBillions.year
      ? { value: (e.debt.value / 100) * e.gdpBillions.value * 1e9, year: e.debt.year, source: "imf" as const }
      : null;
  return {
    gdp: fact(e.gdpBillions, "imf", 1e9),
    gdpRank: gdpRank(id),
    gdpPerCapita: fact(e.gdpPerCapita, "imf"),
    gdpPerCapitaPpp: fact(e.gdpPerCapitaPpp, "imf"),
    growth: fact(e.growth, "imf"),
    inflation: fact(e.inflation, "imf"),
    debt: fact(e.debt, "imf"),
    debtUsd,
  };
}

const ENERGY_RESOURCES = [
  { id: "oil", name: "Crude oil" },
  { id: "gas", name: "Natural gas" },
  { id: "coal", name: "Coal" },
] as const;

// Energy first (fixed order), then minerals by world share of production, then of reserves.
// Energy production is EIA (API); coal reserves EIA (API); oil and gas reserves EIA via Our World in Data.
function buildResources(id: string): Resource[] {
  const resources: Resource[] = [];
  const e = eia[id] ?? {};
  const owidReserves = fossilReserves[id] ?? {};
  for (const r of ENERGY_RESOURCES) {
    const production = e[`${r.id}.production`];
    const eiaReserves = e[`${r.id}.reserves`];
    const owidReserve = r.id === "coal" ? undefined : owidReserves[r.id];
    const reserves: Amount | null = eiaReserves
      ? { ...eiaReserves, source: "eia" }
      : owidReserve
        ? { ...owidReserve, source: "eia" }
        : null;
    if (production === undefined && reserves === null) {
      continue;
    }
    resources.push({
      id: r.id,
      name: r.name,
      category: "energy",
      production: production ? { ...production, source: "eia" } : null,
      reserves,
    });
  }

  const minerals: Resource[] = Object.entries(usgs[id] ?? {}).map(([mineralId, m]) => ({
    id: mineralId,
    name: m.name,
    category: "mineral",
    production: m.production ? { ...m.production, source: "usgs" } : null,
    reserves: m.reserves ? { ...m.reserves, source: "usgs" } : null,
  }));
  const share = (r: Resource) => r.production?.worldShare ?? -1;
  const reserveShare = (r: Resource) => r.reserves?.worldShare ?? -1;
  minerals.sort((a, b) => share(b) - share(a) || reserveShare(b) - reserveShare(a));

  return [...resources, ...minerals];
}

function buildAgriculture(id: string): Agriculture | null {
  const f = faostat[id];
  if (f === undefined) {
    return null;
  }
  return { year: f.year, source: "faostat", largest: f.largest, worldLeading: f.worldLeading };
}

function buildPower(id: string): Power {
  const e = energy[id];
  const access = fact(worldbank[id]?.electricityAccess, "worldbank");
  if (e === undefined) {
    return { generation: null, electricityAccess: access };
  }
  const mix = (Object.entries(e.mixTwh) as [PowerSource, number][])
    .filter(([, twh]) => twh > 0)
    .map(([source, twh]) => ({ source, twh }))
    .sort((a, b) => b.twh - a.twh);
  return { generation: { year: e.year, source: "ember", totalTwh: e.totalTwh, mix }, electricityAccess: access };
}

// ---------- write files + coverage report ----------

const countries = loadCountries();
rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });
const builtAt = new Date().toISOString().slice(0, 10);
const all: CountryData[] = [];
for (const c of countries) {
  const data: CountryData = {
    id: c.id,
    name: c.name,
    builtAt,
    government: buildGovernment(c.id),
    population: buildPopulation(c.id),
    economy: buildEconomy(c.id),
    resources: buildResources(c.id),
    agriculture: buildAgriculture(c.id),
    power: buildPower(c.id),
  };
  all.push(data);
  writeFileSync(`${OUTPUT_DIR}/${c.id}.json`, JSON.stringify(data));
}

// The list view's data: one row per country.
const summary: CountrySummary[] = all.map((d) => ({
  id: d.id,
  name: d.name,
  population: d.population.total?.value ?? null,
  fertility: d.population.fertility?.value ?? null,
  medianAge: d.population.medianAge?.value ?? null,
  density: d.population.density?.value ?? null,
  gdp: d.economy.gdp?.value ?? null,
  gdpPerCapita: d.economy.gdpPerCapita?.value ?? null,
  gdpPerCapitaPpp: d.economy.gdpPerCapitaPpp?.value ?? null,
  growth: d.economy.growth?.value ?? null,
  inflation: d.economy.inflation?.value ?? null,
  debtUsd: d.economy.debtUsd?.value ?? null,
  debtPercent: d.economy.debt?.value ?? null,
}));
writeFileSync(SUMMARY_FILE, JSON.stringify(summary));

const coverage: [string, (d: CountryData) => unknown][] = [
  ["government.type", (d) => d.government.type],
  ["government.rulingParty", (d) => d.government.rulingParty],
  ["government.headOfState", (d) => d.government.headOfState],
  ["government.headOfGovernment", (d) => d.government.headOfGovernment],
  ["population.total", (d) => d.population.total],
  ["population.density", (d) => d.population.density],
  ["population.fertility", (d) => d.population.fertility],
  ["population.lifeExpectancy", (d) => d.population.lifeExpectancy],
  ["population.medianAge", (d) => d.population.medianAge],
  ["population.ageStructure", (d) => d.population.ageStructure],
  ["economy.gdp", (d) => d.economy.gdp],
  ["economy.gdpPerCapitaPpp", (d) => d.economy.gdpPerCapitaPpp],
  ["economy.growth", (d) => d.economy.growth],
  ["economy.inflation", (d) => d.economy.inflation],
  ["economy.debt", (d) => d.economy.debt],
  ["economy.debtUsd", (d) => d.economy.debtUsd],
  ["resources (any)", (d) => d.resources.length > 0 || null],
  ["resources oil production", (d) => d.resources.find((r) => r.id === "oil")?.production],
  ["agriculture", (d) => d.agriculture],
  ["power.generation", (d) => d.power.generation],
  ["power.electricityAccess", (d) => d.power.electricityAccess],
];
console.log(`Built ${all.length} country files. Coverage:`);
for (const [label, pick] of coverage) {
  const have = all.filter((d) => pick(d) !== null && pick(d) !== undefined);
  const missing = all.filter((d) => !have.includes(d)).map((d) => d.id);
  const shown = missing.length > 25 ? `${missing.slice(0, 25).join(" ")} …` : missing.join(" ");
  console.log(`  ${label.padEnd(30)} ${String(have.length).padStart(3)}/${all.length}  missing: ${shown}`);
}
