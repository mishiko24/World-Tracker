// List view: every country in a sortable table (public/data/summary.json), columns grouped like the
// info panel's sections (columns.ts). A group header collapses its columns into a narrow "+" strip;
// click the strip to open it again. Collapsed groups are remembered in settings.
//
// Click a column header to sort: first click = highest first (text A→Z), click again to reverse.
// Countries without a value always sit at the bottom. Left-click a row to select it (info panel),
// right-click a row to compare it with the selected one.

import { useMemo } from "react";
import { Flag } from "../Flag";
import type { CountrySummary } from "../../data/countryData";
import { useDataMeta } from "../../data/useDataMeta";
import { allColumns, columnGroups, type Column, type ColumnGroup } from "./columns";
import { METRIC_HINTS } from "../info/hints";
import { DEFAULT_SORT, nextSort, sortRows, type Sort } from "./sort";

interface CountryListProps {
  rows: CountrySummary[] | null; // null while summary.json loads
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  collapsed: string[]; // ColumnGroup ids
  onCollapsedChange: (collapsed: string[]) => void;
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

// groupStart: the first column of a group, drawn with a separator line on its left.
function Cell({ column, row, groupStart }: { column: Column; row: CountrySummary; groupStart: boolean }) {
  const start = groupStart ? "group-start" : "";
  if (column.kind === "text") {
    const value = column.value(row);
    return (
      <td className={`text-cell ${start}`} title={value ?? undefined} data-column={column.id}>
        {value ?? <span className="no-data">—</span>}
      </td>
    );
  }
  const value = column.value(row);
  return <td className={start || undefined} data-column={column.id}>{value === null ? <span className="no-data">—</span> : column.format(value)}</td>;
}

export function CountryList(props: CountryListProps) {
  const { rows, sort, onSortChange, collapsed, onCollapsedChange, selectedId, comparedId, onSelect, onCompare } = props;
  const meta = useDataMeta();
  const groups = useMemo(() => (meta === null ? null : columnGroups(meta.resources)), [meta]);

  const classes = ["country-list"];
  if (props.leftPanelOpen) {
    classes.push("left-panel-open");
  }
  if (props.rightPanelOpen) {
    classes.push("right-panel-open");
  }

  if (rows === null || groups === null) {
    return (
      <div className={classes.join(" ")}>
        <p className="panel-message">Loading…</p>
      </div>
    );
  }

  const columns = allColumns(groups);
  // A sort id with no column (an old link, a resource that lost its column) sorts by Power Level.
  const activeSort = sort.key === "name" || columns.some((c) => c.id === sort.key) ? sort : DEFAULT_SORT;
  const sortColumn = columns.find((c) => c.id === activeSort.key) ?? null;
  const sorted = sortRows(rows, sortColumn, activeSort.descending);

  const isOpen = (g: ColumnGroup) => !collapsed.includes(g.id);
  function toggle(g: ColumnGroup) {
    onCollapsedChange(isOpen(g) ? [...collapsed, g.id] : collapsed.filter((id) => id !== g.id));
  }

  // The sort arrow follows the label; the unit (if any) is a small line below. `hint` (what the metric means)
  // is the header's tooltip.
  function header(key: string, isText: boolean, label: string, unit?: string, className?: string, rowSpan?: number, hint?: string) {
    const arrow = key === activeSort.key ? (activeSort.descending ? " ▼" : " ▲") : "";
    return (
      <th
        key={key}
        className={className}
        rowSpan={rowSpan}
        data-column={key}
        title={hint}
        onClick={() => onSortChange(nextSort(activeSort, key, isText))}
      >
        {label}
        {arrow}
        {unit !== undefined && <span className="column-unit">{unit}</span>}
      </th>
    );
  }

  return (
    <div className={classes.join(" ")}>
      <table>
        <thead>
          <tr className="group-row">
            {header("name", true, "Name", undefined, "name-column", 2)}
            {groups.map((g) =>
              isOpen(g) ? (
                <th key={g.id} colSpan={g.columns.length} className="group-header group-start">
                  <button onClick={() => toggle(g)} title={`Hide the ${g.label} columns`}>
                    <span className="group-toggle">−</span>
                    {g.label}
                  </button>
                </th>
              ) : (
                <th key={g.id} rowSpan={2} className="group-strip group-start" onClick={() => toggle(g)} title={`Show the ${g.label} columns`}>
                  <span className="group-toggle">+</span>
                </th>
              ),
            )}
          </tr>
          <tr className="column-row">
            {groups.filter(isOpen).flatMap((g) =>
              g.columns.map((c, i) =>
                header(
                  c.id,
                  c.kind === "text",
                  c.label,
                  c.kind === "number" ? c.unit : undefined,
                  [i === 0 ? "group-start" : "", c.kind === "text" ? "text-cell" : ""].join(" ").trim() || undefined,
                  undefined,
                  c.kind === "number" ? c.hint : METRIC_HINTS[c.label],
                ),
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, rowIndex) => (
            <tr
              key={row.id}
              className={rowClass(row.id, selectedId, comparedId)}
              onClick={() => onSelect(row.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                onCompare(row.id);
              }}
            >
              <td className="name-column">
                <span className="name-with-flag">
                  <Flag id={row.id} />
                  {row.name}
                </span>
              </td>
              {groups.map((g) =>
                isOpen(g) ? (
                  g.columns.map((c, i) => <Cell key={c.id} column={c} row={row} groupStart={i === 0} />)
                ) : rowIndex === 0 ? (
                  // One tall cell under the strip header: the whole strip is a single click target.
                  <td
                    key={g.id}
                    rowSpan={sorted.length}
                    className="group-strip group-start"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(g);
                    }}
                    title={`Show the ${g.label} columns`}
                  >
                    <span className="group-strip-label">{g.label}</span>
                  </td>
                ) : null,
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
