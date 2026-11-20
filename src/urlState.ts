// The shareable part of the app state, kept in the URL query string:
//   ?c=ESP            selected country (our id = Natural Earth ADM0_A3)
//   &vs=FRA           compared country
//   &view=list        list view instead of the map
//   &sort=gdp.desc    list sort column and direction
// Read once on load; rewritten (replaceState, no history spam) whenever that state changes.

import { DEFAULT_SORT, isSortKey, type Sort } from "./ui/list/sort";

export interface UrlState {
  selectedId: string | null;
  comparedId: string | null;
  listView: boolean | null; // null = not in the URL, keep the saved setting
  sort: Sort;
}

export function readUrlState(validIds: Set<string>): UrlState {
  const params = new URLSearchParams(window.location.search);
  const id = (name: string) => {
    const value = params.get(name)?.toUpperCase() ?? null;
    return value !== null && validIds.has(value) ? value : null;
  };
  const selectedId = id("c");
  const comparedId = selectedId === null ? null : id("vs");
  const view = params.get("view");
  const [sortKey, direction] = (params.get("sort") ?? "").split(".");
  const sort = isSortKey(sortKey) ? { key: sortKey, descending: direction !== "asc" } : DEFAULT_SORT;
  return {
    selectedId,
    comparedId: comparedId === selectedId ? null : comparedId,
    listView: view === "list" ? true : view === "map" ? false : null,
    sort,
  };
}

export function writeUrlState(state: { selectedId: string | null; comparedId: string | null; listView: boolean; sort: Sort }): void {
  const params = new URLSearchParams();
  if (state.selectedId !== null) {
    params.set("c", state.selectedId);
  }
  if (state.comparedId !== null) {
    params.set("vs", state.comparedId);
  }
  if (state.listView) {
    params.set("view", "list");
    params.set("sort", `${state.sort.key}.${state.sort.descending ? "desc" : "asc"}`);
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  if (url !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", url);
  }
}
