// One labeled value. A null value shows "No data".
// Year and source are not printed (too much clutter); they appear as a tooltip on the value.
// Comparison mode (`compare` set): a second value column for country B, see Compare.tsx.

import type { ReactNode } from "react";
import { SOURCES, type SourceId } from "../../data/countryData";
import { difference, winner, type Comparison } from "./Compare";

interface FactRowProps {
  label: ReactNode;
  value: ReactNode | null;
  year?: number;
  source?: SourceId;
  meta?: ReactNode; // small line under the value, e.g. world rank
  compare?: Comparison; // undefined = not comparing
}

export function sourceTooltip(year: number | undefined, source: SourceId | undefined): string | undefined {
  if (source === undefined) {
    return undefined;
  }
  return year === undefined ? SOURCES[source].name : `${year} · ${SOURCES[source].name}`;
}

const NO_DATA = <span className="no-data">No data</span>;

export function FactRow({ label, value, year, source, meta, compare }: FactRowProps) {
  const win = compare === undefined ? null : winner(compare);
  return (
    <div className={compare === undefined ? "fact" : "fact comparing"}>
      <span className="fact-label">{label}</span>
      <span className={win === "a" ? "fact-value win" : "fact-value"} title={sourceTooltip(year, source)}>
        <span className="fact-main">{value === null ? NO_DATA : value}</span>
        {value !== null && meta && <span className="fact-meta">{meta}</span>}
      </span>
      {compare !== undefined && (
        <span className={win === "b" ? "fact-value win" : "fact-value"}>
          <span className="fact-main">{compare.b === null ? NO_DATA : compare.format(compare.b)}</span>
          {difference(compare) !== null && <span className="fact-meta">{difference(compare)}</span>}
        </span>
      )}
    </div>
  );
}
