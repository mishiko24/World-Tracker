// A country's world rankings across the list view's number columns: "#1 of 196 in wheat production".
// Used by the "World rankings" share card and the static country pages.

import type { CountrySummary } from "./countryData";
import type { NumberColumn } from "../ui/list/columns";

// A ranking of fewer countries than this is too thin to count (also the minimum for a ranking page).
export const MIN_RANKED = 15;

// A place shared by more countries than this isn't a boast (100% access to electricity: ~100 countries).
const MAX_TIED = 3;

// Columns where being highest isn't something to show off (or where higher isn't better).
const NOT_A_BOAST = new Set(["inflation", "debtUsd", "debtPercent", "density", "medianAge", "fertility", "under15", "from15to64", "over65"]);

export interface WorldRank {
  column: NumberColumn;
  rank: number; // 1 = highest; equal values share a rank
  of: number; // countries with a value
  value: number;
}

// Every boast-worthy ranking the country appears in, best first (lower rank, then bigger field).
export function worldRanks(id: string, rows: CountrySummary[], columns: NumberColumn[]): WorldRank[] {
  const row = rows.find((r) => r.id === id)!;
  const ranks: WorldRank[] = [];
  for (const column of columns) {
    // Budget shares are priorities, not achievements, and cover ~40 countries: no "world" rank.
    // Shares of exports describe an economy's mix, not an achievement; neither is a trade deficit.
    if (NOT_A_BOAST.has(column.id) || column.id === "govSpending" || column.id.startsWith("budget.") || column.id.startsWith("exportGroup.") || column.id === "imports") {
      continue;
    }
    const value = column.value(row);
    if (value === null || value <= 0) {
      continue;
    }
    const values = rows.map((r) => column.value(r)).filter((v): v is number => v !== null);
    if (values.length < MIN_RANKED) {
      continue;
    }
    if (values.filter((v) => v === value).length > MAX_TIED) {
      continue;
    }
    ranks.push({ column, rank: 1 + values.filter((v) => v > value).length, of: values.length, value });
  }
  return ranks.sort((x, y) => x.rank - y.rank || y.of - x.of);
}

// The value with the unit that the list view keeps in its column header: "11 TWh", "1.2 M bbl/day".
const UNIT_SUFFIX: Record<string, string> = {
  "TWh/year": " TWh",
  "barrels/day": " bbl/day",
  barrels: " bbl",
  "m³/year": " m³",
  "m³": " m³",
  "carats/year": " carats",
  carats: " carats",
  years: " years",
  "per km²": " per km²",
};

export function valueWithUnit(column: NumberColumn, value: number): string {
  return column.format(value) + (column.unit === undefined ? "" : (UNIT_SUFFIX[column.unit] ?? ""));
}
