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
  DataMeta,
  Economy,
  Government,
  Military,
  NumberFact,
  Population,
  Power,
  PowerSource,
  RankFact,
  Resource,
  ResourceInfo,
  SourceId,
  TextFact,
} from "../../src/data/countryData.ts";
import { STAPLES } from "../../src/data/countryData.ts";
import { loadCountries } from "./lib/countries.ts";
import { lastFullYear, readCache } from "./lib/io.ts";
import { computeNearby } from "./nearby.ts";
import { computePowerLevels, POWER_LEVEL_VERSION } from "./powerLevel.ts";
import type { EiaEntry } from "./fetch/eia.ts";
import type { FossilReservesEntry } from "./fetch/fossilReserves.ts";
import type { EnergyEntry } from "./fetch/energy.ts";
import type { FactbookEntry } from "./fetch/factbook.ts";
import type { FaoEntry } from "./fetch/faostat.ts";
import type { UnWppEntry } from "./fetch/unwpp.ts";
import type { UsgsEntry } from "./fetch/usgs.ts";
import type { WikidataEntry } from "./fetch/wikidata.ts";
import type { WorldBankEntry } from "./fetch/worldbank.ts";

// Resources that get list columns: a column needs at least this many countries with the number.
const MIN_RESOURCE_COUNTRIES = 3;

const OUTPUT_DIR = "public/data/countries";
const SUMMARY_FILE = "public/data/summary.json";
const META_FILE = "public/data/meta.json";
const NEARBY_FILE = "public/data/nearby.json"; // which regional comparison pages exist (src/data/sitePages.ts)

const worldbank = readCache<WorldBankEntry>("worldbank").byCountry;
const wikidata = readCache<WikidataEntry>("wikidata").byCountry;
const factbook = readCache<FactbookEntry>("factbook").byCountry;
const unwpp = readCache<UnWppEntry>("unwpp").byCountry;
const eia = readCache<EiaEntry>("eia").byCountry;
const fossilReserves = readCache<FossilReservesEntry>("reserves").byCountry;
const usgs = readCache<UsgsEntry>("usgs").byCountry;
const faostat = readCache<FaoEntry>("faostat").byCountry;
const energy = readCache<EnergyEntry>("energy").byCountry;

// World Bank keeps a country's last value forever (Germany's central government debt is from 1990).
// Values older than this are hidden rather than shown as if current.
const MAX_AGE_YEARS = 6;

function fresh(entry: { value: number; year: number } | undefined): { value: number; year: number } | undefined {
  if (entry === undefined || entry.year < lastFullYear() - MAX_AGE_YEARS) {
    return undefined;
  }
  return entry;
}

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
    politicalStability: fact(fresh(worldbank[id]?.politicalStability), "worldbank"),
  };
}

function buildPopulation(id: string): Population {
  const wb = worldbank[id] ?? {};
  const un = unwpp[id] ?? {};
  const under15 = fresh(wb.under15);
  const age =
    under15 && wb.from15to64 && wb.over65
      ? { under15: under15.value, from15to64: wb.from15to64.value, over65: wb.over65.value, year: under15.year, source: "worldbank" as const }
      : null;
  return {
    total: fact(fresh(wb.population), "worldbank") ?? fact(un.population, "unwpp"),
    density: fact(fresh(wb.density), "worldbank"),
    fertility: fact(fresh(wb.fertility), "worldbank") ?? fact(un.fertility, "unwpp"),
    lifeExpectancy: fact(fresh(wb.lifeExpectancy), "worldbank") ?? fact(un.lifeExpectancy, "unwpp"),
    medianAge: fact(un.medianAge, "unwpp"),
    ageStructure: age,
  };
}

// GDP rank among all countries with a World Bank GDP figure (each country's latest year).
function gdpRank(id: string): RankFact | null {
  const own = fresh(worldbank[id]?.gdp);
  if (own === undefined) {
    return null;
  }
  const all = Object.values(worldbank).flatMap((e) => {
    const gdp = fresh(e.gdp);
    return gdp ? [gdp.value] : [];
  });
  return { rank: 1 + all.filter((g) => g > own.value).length, of: all.length, year: own.year, source: "worldbank" };
}

// Debt in dollars = debt % × GDP of the same year (debt figures often lag GDP by years).
function debtUsd(entry: WorldBankEntry): NumberFact | null {
  const debt = fresh(entry.debt);
  const gdpThatYear = debt ? entry.gdpByYear?.[String(debt.year)] : undefined;
  if (debt === undefined || gdpThatYear === undefined) {
    return null;
  }
  return { value: (debt.value / 100) * gdpThatYear, year: debt.year, source: "worldbank" };
}

function buildEconomy(id: string): Economy {
  const wb = worldbank[id] ?? {};
  return {
    gdp: fact(fresh(wb.gdp), "worldbank"),
    gdpRank: gdpRank(id),
    gdpPerCapita: fact(fresh(wb.gdpPerCapita), "worldbank"),
    gdpPerCapitaPpp: fact(fresh(wb.gdpPerCapitaPpp), "worldbank"),
    growth: fact(fresh(wb.growth), "worldbank"),
    inflation: fact(fresh(wb.inflation), "worldbank"),
    debt: fact(fresh(wb.debt), "worldbank"),
    debtUsd: debtUsd(wb),
  };
}

// Factbook spending older than this many years before the newest Factbook year is not current any more.
const MILITARY_MAX_AGE_YEARS = 3;
const newestSpendingYear = Math.max(...Object.values(factbook).flatMap((f) => f.militarySpending.map(([year]) => year)));

function buildMilitary(id: string, population: Population): Military {
  const f = factbook[id];
  const history = f?.militarySpending ?? [];
  const latest = history.at(-1);
  if (latest === undefined || latest[0] < newestSpendingYear - MILITARY_MAX_AGE_YEARS) {
    return { spending: null, spendingUsd: null, spendingPerPerson: null, ...personnelFacts(f?.personnel ?? null, population) };
  }
  // In dollars: the newest year the World Bank also has a GDP for (2025 estimates come before 2025 GDP).
  const gdpByYear = worldbank[id]?.gdpByYear ?? {};
  const withGdp = history.findLast(([year]) => gdpByYear[String(year)] !== undefined);
  const usd = withGdp && { value: (withGdp[1] / 100) * gdpByYear[String(withGdp[0])], year: withGdp[0], source: "factbook" as const };
  const people = population.total?.value;
  return {
    spending: { value: latest[1], year: latest[0], source: "factbook" },
    spendingUsd: usd ?? null,
    spendingPerPerson: usd && people !== undefined ? { ...usd, value: usd.value / people } : null,
    ...personnelFacts(f?.personnel ?? null, population),
  };
}

function personnelFacts(p: FactbookEntry["personnel"], population: Population): Pick<Military, "personnel" | "personnelPer1000"> {
  if (p === null) {
    return { personnel: null, personnelPer1000: null };
  }
  const value = (p.low + p.high) / 2;
  const people = population.total?.value;
  return {
    personnel: { value, low: p.low, high: p.high, year: p.year, source: "factbook", note: p.text },
    personnelPer1000: people === undefined ? null : { value: (value / people) * 1000, year: p.year, source: "factbook" },
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
  return { year: f.year, source: "faostat", largest: f.largest, worldLeading: f.worldLeading, all: f.all };
}

function buildPower(id: string): Power {
  const e = energy[id];
  const access = fact(fresh(worldbank[id]?.electricityAccess), "worldbank");
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
  const population = buildPopulation(c.id);
  const military = buildMilitary(c.id, population);
  const spendingHistory = factbook[c.id]?.militarySpending ?? [];
  all.push({
    id: c.id,
    name: c.name,
    builtAt,
    powerLevel: null, // filled below, needs every country
    government: buildGovernment(c.id),
    population,
    economy: buildEconomy(c.id),
    military,
    resources: buildResources(c.id),
    agriculture: buildAgriculture(c.id),
    power: buildPower(c.id),
    // No freshness rule for World Bank trends: old years are the point of a trend. Military spending history
    // only when the latest figure is current (otherwise the chart would end years ago without saying why).
    trends: {
      ...(worldbank[c.id]?.trends ?? {}),
      ...(military.spending !== null && spendingHistory.length > 1 ? { militarySpending: spendingHistory } : {}),
    },
  });
}
const powerLevels = computePowerLevels(all);
for (const data of all) {
  data.powerLevel = powerLevels.get(data.id) ?? null;
  writeFileSync(`${OUTPUT_DIR}/${data.id}.json`, JSON.stringify(data));
}

// The list view's data: one row per country.
const resourceInfo = resourceColumns();
const summary: CountrySummary[] = all.map((d) => summaryOf(d));

// Only resources that have a column; 6 significant digits is plenty for a table and keeps the file small.
function summaryOf(d: CountryData): CountrySummary {
  const amounts = (column: "production" | "reserves") =>
    Object.fromEntries(
      d.resources.flatMap((r) => {
        const value = r[column]?.value;
        const hasColumn = resourceInfo.some((info) => info.id === r.id && info[column] !== null);
        return value === undefined || !hasColumn ? [] : [[r.id, Number(value.toPrecision(6))]];
      }),
    );
  const cropTonnes = new Map((d.agriculture?.all ?? []).map((c) => [c.name, c.tonnes]));
  return {
    id: d.id,
    name: d.name,
    powerLevel: d.powerLevel?.score ?? null,
    population: d.population.total?.value ?? null,
    fertility: d.population.fertility?.value ?? null,
    lifeExpectancy: d.population.lifeExpectancy?.value ?? null,
    medianAge: d.population.medianAge?.value ?? null,
    density: d.population.density?.value ?? null,
    gdp: d.economy.gdp?.value ?? null,
    gdpPerCapita: d.economy.gdpPerCapita?.value ?? null,
    gdpPerCapitaPpp: d.economy.gdpPerCapitaPpp?.value ?? null,
    growth: d.economy.growth?.value ?? null,
    inflation: d.economy.inflation?.value ?? null,
    debtUsd: d.economy.debtUsd?.value ?? null,
    debtPercent: d.economy.debt?.value ?? null,
    politicalStability: d.government.politicalStability?.value ?? null,
    militarySpending: d.military.spending?.value ?? null,
    militarySpendingUsd: d.military.spendingUsd === null ? null : Number(d.military.spendingUsd.value.toPrecision(6)),
    militaryPerPerson: d.military.spendingPerPerson === null ? null : Number(d.military.spendingPerPerson.value.toPrecision(4)),
    militaryPersonnel: d.military.personnel?.value ?? null,
    militaryPerThousand: d.military.personnelPer1000 === null ? null : Number(d.military.personnelPer1000.value.toPrecision(4)),
    electricityTwh: d.power.generation?.totalTwh ?? null,
    electricityAccess: d.power.electricityAccess?.value ?? null,
    pillars: d.powerLevel?.pillars ?? null,
    governmentType: d.government.type?.value ?? null,
    rulingParty: d.government.rulingParty?.value ?? null,
    headOfState: d.government.headOfState?.value ?? null,
    headOfGovernment: d.government.headOfGovernment?.value ?? null,
    under15: d.population.ageStructure?.under15 ?? null,
    from15to64: d.population.ageStructure?.from15to64 ?? null,
    over65: d.population.ageStructure?.over65 ?? null,
    production: amounts("production"),
    reserves: amounts("reserves"),
    crops: Object.fromEntries(STAPLES.flatMap((s) => (cropTonnes.has(s.name) ? [[s.id, cropTonnes.get(s.name)!]] : []))),
    generation: Object.fromEntries((d.power.generation?.mix ?? []).map((m) => [m.source, Number(m.twh.toPrecision(6))])),
  };
}

// Energy first (oil, gas, coal as in the info panel), then minerals A-Z. Same id = same unit (see formatData.ts).
function resourceColumns(): ResourceInfo[] {
  const byId = new Map<string, { info: ResourceInfo; production: number; reserves: number }>();
  for (const d of all) {
    for (const r of d.resources) {
      const entry = byId.get(r.id) ?? { info: { id: r.id, name: r.name, category: r.category, production: null, reserves: null }, production: 0, reserves: 0 };
      if (r.production !== null) {
        entry.info.production = r.production.unit;
        entry.production++;
      }
      if (r.reserves !== null) {
        entry.info.reserves = r.reserves.unit;
        entry.reserves++;
      }
      byId.set(r.id, entry);
    }
  }
  const usable = [...byId.values()]
    .map((e) => ({
      ...e.info,
      production: e.production >= MIN_RESOURCE_COUNTRIES ? e.info.production : null,
      reserves: e.reserves >= MIN_RESOURCE_COUNTRIES ? e.info.reserves : null,
    }))
    .filter((r) => r.production !== null || r.reserves !== null);
  const energyOrder = (r: ResourceInfo) => ENERGY_RESOURCES.findIndex((e) => e.id === r.id);
  const energy = usable.filter((r) => r.category === "energy").sort((a, b) => energyOrder(a) - energyOrder(b));
  const minerals = usable.filter((r) => r.category === "mineral").sort((a, b) => a.name.localeCompare(b.name));
  return [...energy, ...minerals];
}
writeFileSync(SUMMARY_FILE, JSON.stringify(summary));

const meta: DataMeta = {
  builtAt,
  powerLevelVersion: POWER_LEVEL_VERSION,
  countries: all.length,
  scored: all.filter((d) => d.powerLevel !== null).length,
  resources: resourceInfo,
};
writeFileSync(META_FILE, JSON.stringify(meta));
writeFileSync(NEARBY_FILE, JSON.stringify(computeNearby(all)));

const coverage: [string, (d: CountryData) => unknown][] = [
  ["powerLevel", (d) => d.powerLevel],
  ["government.type", (d) => d.government.type],
  ["government.rulingParty", (d) => d.government.rulingParty],
  ["government.headOfState", (d) => d.government.headOfState],
  ["government.headOfGovernment", (d) => d.government.headOfGovernment],
  ["government.politicalStability", (d) => d.government.politicalStability],
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
  ["military.spending", (d) => d.military.spending],
  ["military.spendingUsd", (d) => d.military.spendingUsd],
  ["military.personnel", (d) => d.military.personnel],
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

// Power Level calibration view: top 30 with pillar scores.
console.log("\nPower Level top 30 (score | econ res pop energy food stab):");
for (const d of [...all].filter((d) => d.powerLevel).sort((a, b) => b.powerLevel!.score - a.powerLevel!.score).slice(0, 30)) {
  const p = d.powerLevel!.pillars;
  const cells = [p.economy, p.resources, p.population, p.energy, p.food, p.stability].map((v) => (v === null ? "  —" : v.toFixed(0).padStart(3)));
  console.log(`  ${String(d.powerLevel!.rank).padStart(3)}. ${d.name.padEnd(24)} ${d.powerLevel!.score.toFixed(1).padStart(5)} | ${cells.join(" ")}`);
}
