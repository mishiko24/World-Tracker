// List sorting state. Lives in App (not CountryList) so it can be part of the shareable URL.

import type { CountrySummary } from "../../data/countryData";
import { COLUMNS, type NumericKey } from "./columns";

export type SortKey = "name" | NumericKey;

export interface Sort {
  key: SortKey;
  descending: boolean;
}

export const DEFAULT_SORT: Sort = { key: "population", descending: true };

export function isSortKey(key: string): key is SortKey {
  return key === "name" || COLUMNS.some((c) => c.key === key);
}

// First click on a column = highest first (names A→Z); clicking the same column again reverses.
export function nextSort(current: Sort, key: SortKey): Sort {
  if (key === current.key) {
    return { key, descending: !current.descending };
  }
  return { key, descending: key !== "name" };
}

// Missing values always sort last, in either direction.
export function sortRows(rows: CountrySummary[], sort: Sort): CountrySummary[] {
  const direction = sort.descending ? -1 : 1;
  if (sort.key === "name") {
    return [...rows].sort((a, b) => direction * a.name.localeCompare(b.name));
  }
  const key = sort.key;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va === null || vb === null) {
      return Number(va === null) - Number(vb === null);
    }
    return direction * (va - vb);
  });
}
