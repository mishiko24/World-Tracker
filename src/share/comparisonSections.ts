// What each comparison card shows: one card per info panel section (Power Level, Government, Population, Economy,
// Military, Resources, Agriculture, Power generation). Drawn by comparisonCard.ts in the fight poster layout:
//   headline  one number per country in the header (the Power Level score, GDP, population, ...)
//   rows      up to six rows: two numbers with bars, or two texts (Government)
// "Better" follows the info panel (src/ui/info/BasicSections.tsx etc.): inflation and debt lower is better;
// density, median age and age groups have no better.

import { PILLAR_LABELS, PILLAR_ORDER, STAPLES, type CountryData, type PowerSource } from "../data/countryData";
import type { Better, DiffMode } from "../ui/info/Compare";
import { dollars, fullNumber, percent, shortNumber, tonnes } from "../ui/info/formatData";
import { POWER_SOURCE_STYLE } from "../ui/info/PowerSection";
import { TRADE_GROUPS, type TradeGroupId } from "../data/trade";

export type SectionId = "powerLevel" | "government" | "population" | "economy" | "military" | "trade" | "resources" | "agriculture" | "power";

export const SECTION_IDS: SectionId[] = ["powerLevel", "government", "population", "economy", "military", "trade", "resources", "agriculture", "power"];

export const SECTION_TITLES: Record<SectionId, string> = {
  powerLevel: "Power Level",
  government: "Government",
  population: "Population",
  economy: "Economy",
  military: "Military",
  trade: "Trade",
  resources: "Resources",
  agriculture: "Agriculture",
  power: "Power generation",
};

export interface NumberRow {
  kind: "number";
  label: string;
  a: number | null;
  b: number | null;
  format: (v: number) => string;
  better?: Better;
  mode?: DiffMode;
  fixedScale?: boolean; // 0-100 scores: bars on one 0-100 scale; otherwise the larger value fills the bar
}

export interface TextRow {
  kind: "text";
  label: string;
  a: string | null;
  b: string | null;
}

export type Row = NumberRow | TextRow;

export interface Headline {
  a: number | null;
  b: number | null;
  format: (v: number) => string;
  better?: Better;
  caption: (side: CountryData) => string; // the small line under the number: "#2 · POWER LEVEL", "GDP"
}

export interface ComparisonSection {
  id: SectionId;
  title: string;
  headline: Headline;
  rows: Row[];
  tally: boolean; // "categories won" line (Power Level only; elsewhere the section title sits there)
}

// World production totals per resource id (from summary.json): picks the resources where the pair matters most.
export type ResourceTotals = Map<string, number>;

const MAX_ROWS = 6;

// Resources people know, so a card compares oil and gold before wollastonite.
const KEY_RESOURCES = [
  "oil", "gas", "coal", "gold", "silver", "copper", "iron-ore", "lithium", "rare-earths", "nickel", "cobalt",
  "bauxite", "zinc", "lead", "tin", "platinum", "diamond-industrial", "gemstones", "potash",
  "phosphate-rock", "manganese", "graphite-natural", "salt",
];

function num(label: string, a: number | null | undefined, b: number | null | undefined, format: (v: number) => string, rest: Partial<NumberRow> = {}): NumberRow {
  return { kind: "number", label, a: a ?? null, b: b ?? null, format, ...rest };
}

// Imports and balance, then the categories that make up most of the two countries' exports (largest first).
function tradeRows(a: CountryData, b: CountryData): Row[] {
  const share = (d: CountryData, id: TradeGroupId) => (d.trade === null || d.trade.exports === 0 ? null : (d.trade.exportsByGroup[id] / d.trade.exports) * 100);
  const signed = (v: number) => (v < 0 ? `−${dollars(-v)}` : `+${dollars(v)}`);
  const groups = TRADE_GROUPS.filter((g) => g.id !== "other")
    .map((g) => ({ g, size: (share(a, g.id) ?? 0) + (share(b, g.id) ?? 0) }))
    .sort((x, y) => y.size - x.size)
    .slice(0, 3);
  return [
    num("Imports", a.trade?.imports, b.trade?.imports, dollars, { better: "none" }),
    num("Trade balance", a.trade === null ? null : a.trade.exports - a.trade.imports, b.trade === null ? null : b.trade.exports - b.trade.imports, signed, { better: "none" }),
    ...groups.map(({ g }) => num(`${g.short} share of exports`, share(a, g.id), share(b, g.id), (v) => percent(v), { mode: "points", better: "none" })),
  ];
}

// A section without any value for either country isn't offered.
export function hasData(section: ComparisonSection): boolean {
  return section.rows.some((r) => r.a !== null || r.b !== null);
}

export function comparisonSection(id: SectionId, a: CountryData, b: CountryData, totals: ResourceTotals): ComparisonSection {
  const base = { id, title: SECTION_TITLES[id], tally: false };
  const caption = (text: string) => () => text.toUpperCase();
  switch (id) {
    case "powerLevel":
      return {
        ...base,
        tally: true,
        headline: {
          a: a.powerLevel?.score ?? null,
          b: b.powerLevel?.score ?? null,
          format: (v) => v.toFixed(1),
          caption: (d) => (d.powerLevel === null ? "TOO LITTLE DATA" : `#${d.powerLevel.rank} · POWER LEVEL`),
        },
        rows: PILLAR_ORDER.map((p) =>
          // Rounded as shown, so a "win" is never between two equal-looking numbers.
          num(PILLAR_LABELS[p], round(a.powerLevel?.pillars[p]), round(b.powerLevel?.pillars[p]), (v) => v.toFixed(0), { mode: "score", fixedScale: true }),
        ),
      };
    case "government":
      return {
        ...base,
        headline: {
          a: a.government.politicalStability?.value ?? null,
          b: b.government.politicalStability?.value ?? null,
          format: (v) => `${v.toFixed(0)}`,
          caption: caption("political stability / 100"),
        },
        rows: [
          { kind: "text", label: "Government", a: a.government.type?.value ?? null, b: b.government.type?.value ?? null },
          { kind: "text", label: "Head of state", a: a.government.headOfState?.value ?? null, b: b.government.headOfState?.value ?? null },
          { kind: "text", label: "Head of gov.", a: a.government.headOfGovernment?.value ?? null, b: b.government.headOfGovernment?.value ?? null },
          { kind: "text", label: "Ruling party", a: a.government.rulingParty?.value ?? null, b: b.government.rulingParty?.value ?? null },
        ],
      };
    case "population":
      return {
        ...base,
        headline: { a: a.population.total?.value ?? null, b: b.population.total?.value ?? null, format: shortNumber, caption: caption("population") },
        rows: [
          num("Life expectancy", a.population.lifeExpectancy?.value, b.population.lifeExpectancy?.value, (v) => `${v.toFixed(1)} yrs`, { mode: "years" }),
          num("Children / woman", a.population.fertility?.value, b.population.fertility?.value, (v) => v.toFixed(2)),
          num("Median age", a.population.medianAge?.value, b.population.medianAge?.value, (v) => `${v.toFixed(1)} yrs`, { mode: "years", better: "none" }),
          num("Density", a.population.density?.value, b.population.density?.value, (v) => `${fullNumber(v)}/km²`, { better: "none" }),
          num("Under 15", a.population.ageStructure?.under15, b.population.ageStructure?.under15, (v) => percent(v, 0), { mode: "points", better: "none" }),
          num("65 and over", a.population.ageStructure?.over65, b.population.ageStructure?.over65, (v) => percent(v, 0), { mode: "points", better: "none" }),
        ],
      };
    case "economy":
      return {
        ...base,
        headline: { a: a.economy.gdp?.value ?? null, b: b.economy.gdp?.value ?? null, format: dollars, caption: caption("GDP") },
        rows: [
          num("GDP per person", a.economy.gdpPerCapita?.value, b.economy.gdpPerCapita?.value, dollars),
          num("Per person (PPP)", a.economy.gdpPerCapitaPpp?.value, b.economy.gdpPerCapitaPpp?.value, dollars),
          num("Real growth", a.economy.growth?.value, b.economy.growth?.value, (v) => percent(v), { mode: "points" }),
          num("Inflation", a.economy.inflation?.value, b.economy.inflation?.value, (v) => percent(v), { mode: "points", better: "lower" }),
          num("Gov. debt", a.economy.debtUsd?.value, b.economy.debtUsd?.value, dollars, { better: "lower" }),
          num("Debt, % of GDP", a.economy.debt?.value, b.economy.debt?.value, (v) => percent(v, 0), { mode: "points", better: "lower" }),
        ],
      };
    case "military":
      return {
        ...base,
        headline: { a: a.military.spendingUsd?.value ?? null, b: b.military.spendingUsd?.value ?? null, format: dollars, caption: caption("military spending") },
        rows: [
          num("Per person", a.military.spendingPerPerson?.value, b.military.spendingPerPerson?.value, (v) => `$${fullNumber(v)}`),
          num("% of GDP", a.military.spending?.value, b.military.spending?.value, (v) => percent(v), { mode: "points", better: "none" }),
          num("Active troops", a.military.personnel?.value, b.military.personnel?.value, shortNumber),
          num("Per 1,000 people", a.military.personnelPer1000?.value, b.military.personnelPer1000?.value, (v) => v.toFixed(1), { better: "none" }),
        ],
      };
    case "trade":
      return { ...base, headline: { a: a.trade?.exports ?? null, b: b.trade?.exports ?? null, format: dollars, caption: caption("goods exports") }, rows: tradeRows(a, b) };
    case "resources":
      return { ...base, headline: countHeadline(a, b, (d) => d.resources.filter((r) => r.production !== null).length, "resources produced"), rows: resourceRows(a, b, totals) };
    case "agriculture":
      return { ...base, headline: countHeadline(a, b, (d) => d.agriculture?.worldLeading.length ?? 0, "world top-10 products"), rows: cropRows(a, b) };
    case "power":
      return {
        ...base,
        headline: {
          a: a.power.generation?.totalTwh ?? null,
          b: b.power.generation?.totalTwh ?? null,
          format: (v) => `${fullNumber(v)} TWh`,
          caption: caption("electricity per year"),
        },
        rows: [num("Access", a.power.electricityAccess?.value, b.power.electricityAccess?.value, (v) => percent(v, 0), { mode: "points" }), ...sourceRows(a, b)],
      };
  }
}

function round(v: number | null | undefined): number | null {
  return v === null || v === undefined ? null : Math.round(v);
}

function countHeadline(a: CountryData, b: CountryData, count: (d: CountryData) => number, label: string): Headline {
  return { a: count(a), b: count(b), format: (v) => String(v), caption: () => label.toUpperCase() };
}

// Well-known resources first (KEY_RESOURCES), then the rest; within each, those both produce first, then the
// bigger share of world production. Production compared.
function resourceRows(a: CountryData, b: CountryData, totals: ResourceTotals): NumberRow[] {
  const production = (d: CountryData, id: string) => d.resources.find((r) => r.id === id)?.production ?? null;
  const share = (id: string) => {
    const total = totals.get(id);
    return total === undefined ? 0 : Math.max(production(a, id)?.value ?? 0, production(b, id)?.value ?? 0) / total;
  };
  const known = (id: string) => Number(KEY_RESOURCES.includes(id));
  const both = (id: string) => Number(production(a, id) !== null && production(b, id) !== null);
  const produced = new Set([...a.resources, ...b.resources].filter((r) => r.production !== null).map((r) => r.id));
  return [...produced]
    .sort((x, y) => known(y) - known(x) || both(y) - both(x) || share(y) - share(x))
    .slice(0, MAX_ROWS)
    .map((id) => {
      const resource = [...a.resources, ...b.resources].find((r) => r.id === id)!;
      const unit = (production(a, id) ?? production(b, id))!.unit;
      return num(resource.name, production(a, id)?.value, production(b, id)?.value, (v) => amountShort(v, unit));
    });
}

// The world's staple foods (STAPLES, the list view's agriculture columns): those both produce first, then the
// bigger share of world production.
function cropRows(a: CountryData, b: CountryData): NumberRow[] {
  const crop = (d: CountryData, name: string) => d.agriculture?.all.find((c) => c.name === name) ?? null;
  const share = (name: string) => Math.max(crop(a, name)?.worldShare ?? 0, crop(b, name)?.worldShare ?? 0);
  const both = (name: string) => Number(crop(a, name) !== null && crop(b, name) !== null);
  return STAPLES.filter((s) => crop(a, s.name) !== null || crop(b, s.name) !== null)
    .sort((x, y) => both(y.name) - both(x.name) || share(y.name) - share(x.name))
    .slice(0, MAX_ROWS)
    .map((s) => num(s.label, crop(a, s.name)?.tonnes, crop(b, s.name)?.tonnes, tonnes));
}

// The pair's biggest sources (by the larger of the two).
function sourceRows(a: CountryData, b: CountryData): NumberRow[] {
  const twh = (d: CountryData, s: PowerSource) => d.power.generation?.mix.find((m) => m.source === s)?.twh ?? null;
  const sources = (Object.keys(POWER_SOURCE_STYLE) as PowerSource[]).filter((s) => twh(a, s) !== null || twh(b, s) !== null);
  return sources
    .sort((x, y) => Math.max(twh(b, y) ?? 0, twh(a, y) ?? 0) - Math.max(twh(b, x) ?? 0, twh(a, x) ?? 0))
    .slice(0, MAX_ROWS - 1)
    .map((s) => num(POWER_SOURCE_STYLE[s].label, twh(a, s), twh(b, s), (v) => `${fullNumber(v)} TWh`));
}

// Resource amounts in a card cell: "12.3 Mt", "13.7 M bbl/d", "1.2 bn m³".
function amountShort(value: number, unit: string): string {
  if (unit.startsWith("t")) {
    return tonnes(value);
  }
  if (unit.startsWith("kg")) {
    return value >= 1000 ? tonnes(value / 1000) : `${fullNumber(value)} kg`;
  }
  if (unit === "bbl/day") {
    return `${shortNumber(value)} bbl/d`;
  }
  if (unit.startsWith("m³")) {
    return `${shortNumber(value)} m³`;
  }
  if (unit.startsWith("carats")) {
    return `${shortNumber(value)} ct`;
  }
  return shortNumber(value);
}
