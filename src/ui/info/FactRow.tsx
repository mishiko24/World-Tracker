// One labeled value. A null value shows "No data".
// Year and source are not printed (too much clutter); they appear as a tooltip on the value.
// Comparison mode, see Compare.tsx:
//   numbers (`compare` set)  two bars in the countries' colors, both values, and how much more/less B has
//   text (`compareText` set) both texts, each marked with its country's color

import type { ReactNode } from "react";
import { SOURCES, type SourceId } from "../../data/countryData";
import { barWidths, difference, winner, type Comparison } from "./Compare";

interface FactRowProps {
  label: ReactNode;
  value: ReactNode | null;
  year?: number;
  source?: SourceId;
  meta?: ReactNode; // small line under the value, e.g. world rank (not shown when comparing)
  compare?: Comparison; // number row in comparison mode; undefined = not comparing
  compareText?: string | null; // text row in comparison mode: B's text; undefined = not comparing
}

export function sourceTooltip(year: number | undefined, source: SourceId | undefined): string | undefined {
  if (source === undefined) {
    return undefined;
  }
  return year === undefined ? SOURCES[source].name : `${year} · ${SOURCES[source].name}`;
}

const NO_DATA = <span className="no-data">No data</span>;

export function FactRow({ label, value, year, source, meta, compare, compareText }: FactRowProps) {
  const tooltip = sourceTooltip(year, source);
  if (compare !== undefined) {
    return <ComparedNumber label={label} value={value} tooltip={tooltip} compare={compare} />;
  }
  if (compareText !== undefined) {
    return (
      <div className="fact compared-text">
        <span className="fact-label">{label}</span>
        <span className="fact-value" title={tooltip}>
          <span className="compared-line">
            <span className="country-swatch a" />
            {value === null ? NO_DATA : value}
          </span>
          <span className="compared-line">
            <span className="country-swatch b" />
            {compareText === null ? NO_DATA : compareText}
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value" title={tooltip}>
        <span className="fact-main">{value === null ? NO_DATA : value}</span>
        {value !== null && meta && <span className="fact-meta">{meta}</span>}
      </span>
    </div>
  );
}

interface ComparedNumberProps {
  label: ReactNode;
  value: ReactNode | null;
  tooltip: string | undefined;
  compare: Comparison;
}

// Label | A's bar and value / B's bar and value / how much more or less B has.
function ComparedNumber({ label, value, tooltip, compare }: ComparedNumberProps) {
  const win = winner(compare);
  const [widthA, widthB] = barWidths(compare);
  const diff = difference(compare);
  return (
    <div className="fact compared-number">
      <span className="fact-label">{label}</span>
      <span className="compared-bars">
        <span className="compare-bar a">
          <span style={{ width: `${widthA}%` }} />
        </span>
        <span className={win === "a" ? "compared-value win" : "compared-value"} title={tooltip}>
          {compare.a === null ? NO_DATA : value}
        </span>
        <span className="compare-bar b">
          <span style={{ width: `${widthB}%` }} />
        </span>
        <span className={win === "b" ? "compared-value win" : "compared-value"}>
          {compare.b === null ? NO_DATA : compare.format(compare.b)}
        </span>
        {diff !== null && (
          <span className="compared-diff">
            <span className="country-swatch b" />
            {diff}
          </span>
        )}
      </span>
    </div>
  );
}
