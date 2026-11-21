// List view columns, grouped like the info panel's sections. Each group can be collapsed to a "+" strip.
// To add a column: add the field to CountrySummary (src/data/countryData.ts), fill it in scripts/data/build.ts
// (summaryOf), then add an entry here. Order here = order on screen.
//
// Column ids are the list's sort keys in the URL (?sort=<id>.desc) and must stay stable.
// Number columns also get a ranking page (scripts/site/pages.ts: rank/<slug>/).

import {
  PILLAR_LABELS,
  PILLAR_ORDER,
  STAPLES,
  type AmountUnit,
  type CountrySummary,
  type PowerSource,
  type ResourceInfo,
  type SummaryNumberKey,
} from "../../data/countryData";
import { dollars, fullNumber, percent, shortNumber, tonnes } from "../info/formatData";
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
  columns: Column[];
}

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

// A plain summary field. Slug = the field in kebab case (the original ranking page addresses).
// fullLabel defaults to "Label (unit)".
function field(key: SummaryNumberKey, label: string, format: (v: number) => string, unit?: string, fullLabel?: string): NumberColumn {
  fullLabel ??= unit === undefined ? label : `${label} (${unit})`;
  return { kind: "number", id: key, label, unit, fullLabel, slug: kebab(key), value: (row) => row[key], format };
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
  };
}

const SOURCES = Object.keys(POWER_SOURCE_STYLE) as PowerSource[];

// resources: DataMeta.resources (which resources have columns, and their units).
export function columnGroups(resources: ResourceInfo[]): ColumnGroup[] {
  return [
    {
      id: "powerLevel",
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
      id: "production",
      label: "Resources: production",
      columns: resources.flatMap((r) => (r.production === null ? [] : [resourceColumn(r, "production", r.production)])),
    },
    {
      id: "reserves",
      label: "Resources: reserves",
      columns: resources.flatMap((r) => (r.reserves === null ? [] : [resourceColumn(r, "reserves", r.reserves)])),
    },
    {
      id: "agriculture",
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
        }),
      ),
    },
    {
      id: "power",
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
          }),
        ),
      ],
    },
  ];
}

export function allColumns(groups: ColumnGroup[]): Column[] {
  return groups.flatMap((g) => g.columns);
}
