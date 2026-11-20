// List view columns. To add one: add the field to CountrySummary (src/data/countryData.ts),
// fill it in scripts/data/build.ts, then add an entry here. Order here = order on screen.

import type { CountrySummary } from "../../data/countryData";
import { dollars, fullNumber, percent } from "../info/formatData";

export type NumericKey = Exclude<keyof CountrySummary, "id" | "name">;

export interface Column {
  key: NumericKey;
  label: string;
  format: (value: number) => string;
}

export const COLUMNS: Column[] = [
  { key: "powerLevel", label: "Power Level", format: (v) => v.toFixed(1) },
  { key: "population", label: "Population", format: fullNumber },
  { key: "fertility", label: "Births per woman", format: (v) => v.toFixed(2) },
  { key: "medianAge", label: "Median age", format: (v) => v.toFixed(1) },
  { key: "density", label: "Density (per km²)", format: (v) => fullNumber(v) },
  { key: "gdp", label: "GDP", format: dollars },
  { key: "gdpPerCapita", label: "GDP per capita", format: (v) => `$${fullNumber(v)}` },
  { key: "gdpPerCapitaPpp", label: "GDP per capita (PPP)", format: (v) => `$${fullNumber(v)}` },
  { key: "growth", label: "Real growth", format: (v) => percent(v) },
  { key: "inflation", label: "Inflation", format: (v) => percent(v) },
  { key: "debtUsd", label: "Central gov. debt", format: dollars },
  { key: "debtPercent", label: "Central gov. debt (% GDP)", format: (v) => percent(v, 0) },
];
