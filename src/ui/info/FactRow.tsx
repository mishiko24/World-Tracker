// One labeled value with its year and source underneath. A null value shows "No data".

import type { ReactNode } from "react";
import { SOURCES, type SourceId } from "../../data/countryData";

interface FactRowProps {
  label: string;
  value: ReactNode | null;
  year?: number;
  source?: SourceId;
}

export function FactRow({ label, value, year, source }: FactRowProps) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value">
        {value === null ? <span className="no-data">No data</span> : value}
        {value !== null && source && <SourceNote year={year} source={source} />}
      </span>
    </div>
  );
}

export function SourceNote({ year, source }: { year?: number; source: SourceId }) {
  const info = SOURCES[source];
  return (
    <span className="fact-meta" title={info.name}>
      {year !== undefined && `${year} · `}
      {info.short}
    </span>
  );
}
