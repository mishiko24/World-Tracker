// List view columns, grouped like the info panel's sections. Each group can be collapsed to a "+" strip.
// To add a column: add the field to CountrySummary (src/data/countryData.ts), fill it in scripts/data/build.ts
// (summaryOf), then add an entry here. Order here = order on screen.
//
// Column ids are the list's sort keys in the URL (?sort=<id>.desc) and must stay stable.
// Number columns also get a ranking page (scripts/site/pages.ts: rank/<slug>/).

import {
  PILLAR_LABELS,
  PILLAR_ORDER,
  BUDGET_FUNCTIONS,
  STAPLES,
  type AmountUnit,
  type CountrySummary,
  type PowerSource,
  type ResourceInfo,
  type SummaryNumberKey,
} from "../../data/countryData";
import { dollars, fullNumber, percent, shortNumber, tonnes } from "../info/formatData";
import { TRADE_GROUPS } from "../../data/trade";
import { cropHint, METRIC_HINTS, powerSourceHint, resourceHint } from "../info/hints";
import { POWER_SOURCE_STYLE } from "../info/PowerSection";

export interface NumberColumn {
  kind: "number";
  id: string;
  label: string; // header
  unit?: string; // small second header line
  fullLabel: string; // on its own, e.g. a ranking page title: "Crude oil production"
  slug: string; // ranking page: rank/<slug>/
  value: (row: CountrySummary) => number | null;
  format: (value: number) => string;
  hint?: string; // what the metric means (header tooltip); plain fields use METRIC_HINTS by label
}

export interface TextColumn {
  kind: "text";
  id: string;
  label: string;
  value: (row: CountrySummary) => string | null;
}

export type Column = NumberColumn | TextColumn;

export interface ColumnGroup {
  id: string; // remembered in settings when collapsed
  label: string;
  sources: string; // where its numbers come from (all sources the group uses), for map images
  columns: Column[];
}

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

// A plain summary field. Slug = the field in kebab case (the original ranking page addresses).
// fullLabel defaults to "Label (unit)".
function field(key: SummaryNumberKey, label: string, format: (v: number) => string, unit?: string, fullLabel?: string): NumberColumn {
  fullLabel ??= unit === undefined ? label : `${label} (${unit})`;
  return { kind: "number", id: key, label, unit, fullLabel, slug: kebab(key), value: (row) => row[key], format, hint: METRIC_HINTS[label] };
}

function text(id: string, label: string, value: (row: CountrySummary) => string | null): TextColumn {
  return { kind: "text", id, label, value };
}

const score = (v: number) => v.toFixed(0);

// Tables show the number with its unit in the header: "Crude oil" over "barrels/day".
const UNIT_HEADER: Record<AmountUnit, string | undefined> = {
  "bbl/day": "barrels/day",
  bbl: "barrels",
  "m³/year": "m³/year",
  "m³": "m³",
  "t/year": "per year",
  t: undefined,
  "kg/year": "per year",
  kg: undefined,
  "carats/year": "carats/year",
  carats: "carats",
};

function amountCell(unit: AmountUnit): (v: number) => string {
  switch (unit) {
    case "t/year":
    case "t":
      return tonnes;
    case "kg/year":
    case "kg":
      return (v) => (v >= 1000 ? tonnes(v / 1000) : `${fullNumber(v)} kg`);
    default:
      return shortNumber;
  }
}

function resourceColumn(r: ResourceInfo, kind: "production" | "reserves", unit: AmountUnit): NumberColumn {
  return {
    kind: "number",
    id: `${kind}.${r.id}`,
    label: r.name,
    unit: UNIT_HEADER[unit],
    fullLabel: `${r.name} ${kind}`,
    slug: `${r.id}-${kind}`,
    value: (row) => row[kind][r.id] ?? null,
    format: amountCell(unit),
    hint: resourceHint(r.name, kind, unit),
  };
}

const SOURCES = Object.keys(POWER_SOURCE_STYLE) as PowerSource[];

// resources: DataMeta.resources (which resources have columns, and their units).
export function columnGroups(resources: ResourceInfo[]): ColumnGroup[] {
  return [
    {
      id: "powerLevel",
      sources: "World Tracker’s Power Level",
      label: "Power Level",
      columns: [
        field("powerLevel", "Power Level", (v) => v.toFixed(1)),
        ...PILLAR_ORDER.map(
          (p): NumberColumn => ({
            kind: "number",
            id: `pillar.${p}`,
            label: PILLAR_LABELS[p],
            unit: "score",
            fullLabel: `Power Level ${PILLAR_LABELS[p].toLowerCase()} score`,
            slug: `power-level-${p}`,
            value: (row) => row.pillars?.[p] ?? null,
            format: score,
          }),
        ),
      ],
    },
    {
      id: "government",
      sources: "Wikidata, World Bank (WGI)",
      label: "Government",
      columns: [
        text("governmentType", "Government type", (row) => row.governmentType),
        text("rulingParty", "Ruling party", (row) => row.rulingParty),
        text("headOfState", "Head of state", (row) => row.headOfState),
        text("headOfGovernment", "Head of government", (row) => row.headOfGovernment),
        field("politicalStability", "Political stability", score, "0–100"),
      ],
    },
    {
      id: "population",
      sources: "World Bank, UN WPP",
      label: "Population",
      columns: [
        field("population", "Population", fullNumber),
        field("density", "Density", fullNumber, "per km²"),
        field("fertility", "Births per woman", (v) => v.toFixed(2)),
        field("lifeExpectancy", "Life expectancy", (v) => v.toFixed(1), "years"),
        field("medianAge", "Median age", (v) => v.toFixed(1), "years"),
        field("under15", "Under 15", (v) => percent(v, 0), "% of people", "Share of people under 15"),
        field("from15to64", "15–64", (v) => percent(v, 0), "% of people", "Share of people aged 15–64"),
        field("over65", "65 and over", (v) => percent(v, 0), "% of people", "Share of people 65 and over"),
      ],
    },
    {
      id: "economy",
      sources: "World Bank",
      label: "Economy",
      columns: [
        field("gdp", "GDP", dollars),
        field("gdpPerCapita", "GDP per capita", (v) => `$${fullNumber(v)}`),
        field("gdpPerCapitaPpp", "GDP per capita (PPP)", (v) => `$${fullNumber(v)}`),
        field("growth", "Real growth", (v) => percent(v)),
        field("inflation", "Inflation", (v) => percent(v)),
        field("debtUsd", "Central gov. debt", dollars),
        field("debtPercent", "Central gov. debt (% GDP)", (v) => percent(v, 0)),
      ],
    },
    {
      id: "budget",
      sources: "Eurostat, OECD (via Our World in Data)",
      label: "Government budget",
      columns: [
        field("govSpending", "Gov. spending", (v) => percent(v), "% of GDP", "Government spending (% of GDP)"),
        ...BUDGET_FUNCTIONS.map(
          (f): NumberColumn => ({
            kind: "number",
            id: `budget.${f.id}`,
            label: f.label,
            unit: "% of budget",
            fullLabel: `% of budget spent on ${f.label.toLowerCase()}`,
            slug: `${kebab(f.id)}-budget-share`,
            value: (row) => row.budget[f.id] ?? null,
            format: (v) => percent(v),
            hint: `${f.about}. Share of all government spending (central, state and local).`,
          }),
        ),
      ],
    },
    {
      id: "military",
      sources: "CIA World Factbook (final edition), World Bank",
      label: "Military",
      columns: [
        field("militarySpendingUsd", "Military spending", dollars),
        field("militaryPerPerson", "Spending per person", (v) => `$${fullNumber(v)}`, undefined, "Military spending per person"),
        field("militarySpending", "Military spending (% GDP)", (v) => percent(v)),
        field("militaryPersonnel", "Active personnel", fullNumber, undefined, "Active military personnel"),
        field("militaryPerThousand", "Personnel per 1,000", (v) => v.toFixed(1), undefined, "Military personnel per 1,000 people"),
      ],
    },
    {
      id: "trade",
      sources: "CEPII BACI (UN Comtrade)",
      label: "Trade",
      columns: [
        field("exports", "Exports", dollars, "goods"),
        field("imports", "Imports", dollars, "goods"),
        field("tradeBalance", "Trade balance", (v) => (v < 0 ? `−${dollars(-v)}` : `+${dollars(v)}`), "goods"),
        ...TRADE_GROUPS.map(
          (g): NumberColumn => ({
            kind: "number",
            id: `exportGroup.${g.id}`,
            label: g.label,
            unit: "% of exports",
            fullLabel: `${g.label}, % of exports`,
            slug: `${kebab(g.id)}-export-share`,
            value: (row) => row.exportGroups[g.id] ?? null,
            format: (v) => percent(v),
            hint: `${g.about}. Share of the country's goods exports.`,
          }),
        ),
      ],
    },
    {
      id: "production",
      sources: "USGS, EIA",
      label: "Resources: production",
      columns: resources.flatMap((r) => (r.production === null ? [] : [resourceColumn(r, "production", r.production)])),
    },
    {
      id: "reserves",
      sources: "USGS, EIA",
      label: "Resources: reserves",
      columns: resources.flatMap((r) => (r.reserves === null ? [] : [resourceColumn(r, "reserves", r.reserves)])),
    },
    {
      id: "agriculture",
      sources: "FAOSTAT",
      label: "Agriculture",
      columns: STAPLES.map(
        (s): NumberColumn => ({
          kind: "number",
          id: `crop.${s.id}`,
          label: s.label,
          unit: "per year",
          fullLabel: `${s.label} production`,
          slug: `${s.id}-production`,
          value: (row) => row.crops[s.id] ?? null,
          format: tonnes,
          hint: cropHint(s.label),
        }),
      ),
    },
    {
      id: "power",
      sources: "Ember, EIA, World Bank",
      label: "Power generation",
      columns: [
        field("electricityTwh", "Electricity generated", fullNumber, "TWh/year"),
        field("electricityAccess", "Access to electricity", (v) => percent(v), "% of people"),
        ...SOURCES.map(
          (source): NumberColumn => ({
            kind: "number",
            id: `generation.${source}`,
            label: POWER_SOURCE_STYLE[source].label,
            unit: "TWh/year",
            fullLabel: `Electricity from ${POWER_SOURCE_STYLE[source].label.toLowerCase()}`,
            slug: `${source}-electricity`,
            value: (row) => row.generation[source] ?? null,
            format: (v) => shortNumber(v),
            hint: powerSourceHint(POWER_SOURCE_STYLE[source].label),
          }),
        ),
      ],
    },
  ];
}

export function allColumns(groups: ColumnGroup[]): Column[] {
  return groups.flatMap((g) => g.columns);
}

export function numberColumns(groups: ColumnGroup[]): NumberColumn[] {
  return allColumns(groups).filter((c): c is NumberColumn => c.kind === "number");
}
