// List sorting state. Lives in App (not CountryList) so it can be part of the shareable URL.

import type { CountrySummary } from "../../data/countryData";
import type { Column } from "./columns";

// "name" or a column id (src/ui/list/columns.ts).
export type SortKey = string;

export interface Sort {
  key: SortKey;
  descending: boolean;
}

export const DEFAULT_SORT: Sort = { key: "powerLevel", descending: true };

// Column ids are letters, digits, dots and dashes. Whether the column exists is only known once the data
// has loaded; CountryList falls back to DEFAULT_SORT for an id that has no column (e.g. an old link).
export function isSortKey(key: string): boolean {
  return /^[a-zA-Z][\w.-]*$/.test(key);
}

// First click on a column = highest first (names and text A→Z); clicking the same column again reverses.
export function nextSort(current: Sort, key: SortKey, isText: boolean): Sort {
  if (key === current.key) {
    return { key, descending: !current.descending };
  }
  return { key, descending: !isText };
}

// column = null sorts by name. Missing values always sort last, in either direction.
export function sortRows(rows: CountrySummary[], column: Column | null, descending: boolean): CountrySummary[] {
  const direction = descending ? -1 : 1;
  if (column === null) {
    return [...rows].sort((a, b) => direction * a.name.localeCompare(b.name));
  }
  return [...rows].sort((a, b) => {
    const va = column.value(a);
    const vb = column.value(b);
    if (va === null || vb === null) {
      return Number(va === null) - Number(vb === null);
    }
    if (typeof va === "string" || typeof vb === "string") {
      return direction * String(va).localeCompare(String(vb));
    }
    return direction * (va - vb);
  });
}
