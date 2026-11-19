// List view: every country in a sortable table (public/data/summary.json).
// Click a column header to sort: first click = highest first (names A→Z), click again to reverse.
// Countries without a value always sit at the bottom. Click a row to open its info panel.

import { useEffect, useState } from "react";
import type { CountrySummary } from "../../data/countryData";
import { COLUMNS, type NumericKey } from "./columns";

type SortKey = "name" | NumericKey;

interface Sort {
  key: SortKey;
  descending: boolean;
}

interface CountryListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  leftPanelOpen: boolean; // the list makes room for the panels instead of hiding under them
  rightPanelOpen: boolean;
}

function useSummaries(): CountrySummary[] | null {
  const [rows, setRows] = useState<CountrySummary[] | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/summary.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`summary.json: HTTP ${response.status}`);
        }
        return response.json() as Promise<CountrySummary[]>;
      })
      .then(setRows);
  }, []);
  return rows;
}

function sortRows(rows: CountrySummary[], sort: Sort): CountrySummary[] {
  const direction = sort.descending ? -1 : 1;
  if (sort.key === "name") {
    return [...rows].sort((a, b) => direction * a.name.localeCompare(b.name));
  }
  const key = sort.key;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va === null || vb === null) {
      return Number(va === null) - Number(vb === null); // missing values last, either direction
    }
    return direction * (va - vb);
  });
}

export function CountryList({ selectedId, onSelect, leftPanelOpen, rightPanelOpen }: CountryListProps) {
  const rows = useSummaries();
  const [sort, setSort] = useState<Sort>({ key: "population", descending: true });

  function clickHeader(key: SortKey) {
    if (key === sort.key) {
      setSort({ key, descending: !sort.descending });
    } else {
      setSort({ key, descending: key !== "name" });
    }
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
              <tr key={row.id} className={row.id === selectedId ? "selected" : undefined} onClick={() => onSelect(row.id)}>
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
