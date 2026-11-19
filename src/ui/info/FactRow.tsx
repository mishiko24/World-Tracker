// One labeled value. A null value shows "No data".
// Year and source are not printed (too much clutter); they appear as a tooltip on the value.
// In comparison mode `compare` holds the chip for the other country (see Compare.tsx).

import type { ReactNode } from "react";
import { SOURCES, type SourceId } from "../../data/countryData";

interface FactRowProps {
  label: ReactNode;
  value: ReactNode | null;
  year?: number;
  source?: SourceId;
  meta?: ReactNode; // small line under the value, e.g. world rank
  compare?: ReactNode;
}

export function sourceTooltip(year: number | undefined, source: SourceId | undefined): string | undefined {
  if (source === undefined) {
    return undefined;
  }
  return year === undefined ? SOURCES[source].name : `${year} · ${SOURCES[source].name}`;
}

export function FactRow({ label, value, year, source, meta, compare }: FactRowProps) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value" title={sourceTooltip(year, source)}>
        <span className="fact-main">
          {value === null ? <span className="no-data">No data</span> : value}
          {compare}
        </span>
        {value !== null && meta && <span className="fact-meta">{meta}</span>}
      </span>
    </div>
  );
}
