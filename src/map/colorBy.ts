// "Color countries by" any list column (settings.colorBy): each country's fill from its place among all countries
// with a value, lowest to highest (heatColors.ts). By rank, not by value: most of these numbers are so skewed
// (population, GDP, oil) that a linear scale would paint almost every country the same color.
// Countries without a value keep the map style's colors. The same scale draws the "Share map" image (mapCard.ts).

import type { CountrySummary } from "../data/countryData";
import { MIN_RANKED } from "../data/rankings";
import type { ColumnGroup, NumberColumn } from "../ui/list/columns";
import { heatColor } from "./heatColors";
import type { MapType } from "./mapTypes";

export interface ColorScale {
  column: NumberColumn;
  group: ColumnGroup;
  positions: Map<string, number>; // country id -> 0 (lowest) .. 1 (highest); equal values share a position
  ranked: { id: string; name: string; value: number }[]; // highest first
  min: number;
  median: number;
  max: number;
}

// The numbers a map can be colored by, by section: every number column with at least MIN_RANKED countries (the
// same ones that get a ranking page and a map page). Text columns are left out.
export interface MappableGroup {
  group: ColumnGroup;
  columns: NumberColumn[];
}

export function mappableGroups(groups: ColumnGroup[], rows: CountrySummary[]): MappableGroup[] {
  const counted = (c: NumberColumn) => rows.filter((r) => c.value(r) !== null).length;
  return groups
    .map((group) => ({ group, columns: group.columns.filter((c): c is NumberColumn => c.kind === "number" && counted(c) >= MIN_RANKED) }))
    .filter((g) => g.columns.length > 0);
}

export function findColumn(groups: ColumnGroup[], id: string): { column: NumberColumn; group: ColumnGroup } | null {
  for (const group of groups) {
    const column = group.columns.find((c) => c.id === id);
    if (column !== undefined && column.kind === "number") {
      return { column, group };
    }
  }
  return null;
}

export function colorScale(column: NumberColumn, group: ColumnGroup, rows: CountrySummary[]): ColorScale {
  const values = rows
    .map((r) => ({ id: r.id, name: r.name, value: column.value(r) }))
    .filter((r): r is { id: string; name: string; value: number } => r.value !== null);
  const ascending = values.map((v) => v.value).sort((x, y) => x - y);
  const last = Math.max(ascending.length - 1, 1);
  const positions = new Map(
    values.map((v) => {
      const below = ascending.findIndex((x) => x >= v.value);
      const equal = ascending.filter((x) => x === v.value).length;
      return [v.id, (below + (equal - 1) / 2) / last];
    }),
  );
  return {
    column,
    group,
    positions,
    ranked: [...values].sort((x, y) => y.value - x.value),
    min: ascending[0],
    median: ascending[Math.floor(ascending.length / 2)],
    max: ascending[ascending.length - 1],
  };
}

export function scaleFills(scale: ColorScale, mapType: MapType): Map<string, string> {
  return new Map([...scale.positions].map(([id, t]) => [id, heatColor(mapType, t)]));
}
