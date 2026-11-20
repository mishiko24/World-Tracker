// List view: every country in a sortable table (public/data/summary.json).
// Click a column header to sort: first click = highest first (names A→Z), click again to reverse.
// Countries without a value always sit at the bottom. Left-click a row to select it (info panel),
// right-click a row to compare it with the selected one.

import type { CountrySummary } from "../../data/countryData";
import { COLUMNS } from "./columns";
import { nextSort, sortRows, type Sort, type SortKey } from "./sort";

interface CountryListProps {
  rows: CountrySummary[] | null; // null while summary.json loads
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  selectedId: string | null;
  comparedId: string | null;
  onSelect: (id: string) => void;
  onCompare: (id: string) => void;
  leftPanelOpen: boolean; // the list makes room for the panels instead of hiding under them
  rightPanelOpen: boolean;
}

function rowClass(id: string, selectedId: string | null, comparedId: string | null): string | undefined {
  if (id === selectedId) {
    return "selected";
  }
  if (id === comparedId) {
    return "compared";
  }
  return undefined;
}

export function CountryList(props: CountryListProps) {
  const { rows, sort, onSortChange, selectedId, comparedId, onSelect, onCompare, leftPanelOpen, rightPanelOpen } = props;

  function clickHeader(key: SortKey) {
    onSortChange(nextSort(sort, key));
  }

  function arrow(key: SortKey): string {
    if (key !== sort.key) {
      return "";
    }
    return sort.descending ? " ▼" : " ▲";
  }

  const classes = ["country-list"];
  if (leftPanelOpen) {
    classes.push("left-panel-open");
  }
  if (rightPanelOpen) {
    classes.push("right-panel-open");
  }

  return (
    <div className={classes.join(" ")}>
      {rows === null ? (
        <p className="panel-message">Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="name-column" onClick={() => clickHeader("name")}>
                Name{arrow("name")}
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} onClick={() => clickHeader(c.key)}>
                  {c.label}
                  {arrow(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortRows(rows, sort).map((row) => (
              <tr
                key={row.id}
                className={rowClass(row.id, selectedId, comparedId)}
                onClick={() => onSelect(row.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onCompare(row.id);
                }}
              >
                <td className="name-column">{row.name}</td>
                {COLUMNS.map((c) => {
                  const value = row[c.key];
                  return <td key={c.key}>{value === null ? <span className="no-data">—</span> : c.format(value)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
