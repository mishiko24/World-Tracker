// One labeled value. A null value shows "No data".
// Year and source are not printed (too much clutter). One tooltip per row, shown when hovering the row (or
// focusing / tapping the label): what the metric means (`hint`, else METRIC_HINTS by label; see hints.ts),
// then the year and source. No native title tooltips: they would open on top of it.
// Comparison mode, see Compare.tsx:
//   numbers (`compare` set)  two bars in the countries' colors, both values, and how much more/less B has
//   text (`compareText` set) both texts, each with its country's flag

import type { ReactNode } from "react";
import { SOURCES, type SourceId } from "../../data/countryData";
import { barWidths, gap, winner, type Comparison } from "./Compare";
import { METRIC_HINTS } from "./hints";

interface FactRowProps {
  label: ReactNode;
  value: ReactNode | null;
  year?: number;
  source?: SourceId;
  meta?: ReactNode; // small line under the value, e.g. world rank (not shown when comparing)
  compare?: Comparison; // number row in comparison mode; undefined = not comparing
  compareText?: string | null; // text row in comparison mode: B's text; undefined = not comparing
  hint?: string; // what the metric means; defaults to METRIC_HINTS[label]
}

function Label({ label, hint }: { label: ReactNode; hint: string | undefined }) {
  if (hint === undefined) {
    return <span className="fact-label">{label}</span>;
  }
  return (
    <span className="fact-label has-hint" tabIndex={0} data-hint={hint}>
      {label}
    </span>
  );
}

export function sourceTooltip(year: number | undefined, source: SourceId | undefined): string | undefined {
  if (source === undefined) {
    return undefined;
  }
  return year === undefined ? SOURCES[source].name : `${year} · ${SOURCES[source].name}`;
}

// The explanation and the source line, as one tooltip text (a blank line between; CSS keeps line breaks).
export function tooltipText(hint: string | undefined, year?: number, source?: SourceId): string | undefined {
  const parts = [hint, sourceTooltip(year, source)].filter((p) => p !== undefined);
  return parts.length === 0 ? undefined : parts.join("\n\n");
}

const NO_DATA = <span className="no-data">No data</span>;

export function FactRow({ label, value, year, source, meta, compare, compareText, hint }: FactRowProps) {
  const explanation = hint ?? (typeof label === "string" ? METRIC_HINTS[label] : undefined);
  const labelElement = <Label label={label} hint={tooltipText(explanation, year, source)} />;
  if (compare !== undefined) {
    return <ComparedNumber label={labelElement} value={value} compare={compare} />;
  }
  if (compareText !== undefined) {
    return (
      <div className="fact compared-text">
        {labelElement}
        <span className="fact-value">
          <span className="compared-line">
            <span className="flag flag-small flag-a" />
            {value === null ? NO_DATA : value}
          </span>
          <span className="compared-line">
            <span className="flag flag-small flag-b" />
            {compareText === null ? NO_DATA : compareText}
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="fact">
      {labelElement}
      <span className="fact-value">
        <span className="fact-main">{value === null ? NO_DATA : value}</span>
        {value !== null && meta && <span className="fact-meta">{meta}</span>}
      </span>
    </div>
  );
}

interface ComparedNumberProps {
  label: ReactNode;
  value: ReactNode | null;
  compare: Comparison;
}

// Label | A's bar and value / B's bar and value / how much more or less B has.
function ComparedNumber({ label, value, compare }: ComparedNumberProps) {
  const win = winner(compare);
  const [widthA, widthB] = barWidths(compare);
  const diff = gap(compare);
  return (
    <div className="fact compared-number">
      {label}
      <span className="compared-bars">
        <span className={win === "b" ? "compare-bar a lose" : "compare-bar a"}>
          <span style={{ width: `${widthA}%` }} />
        </span>
        <span className={win === "a" ? "compared-value win" : "compared-value"}>
          {compare.a === null ? NO_DATA : value}
        </span>
        <span className={win === "a" ? "compare-bar b lose" : "compare-bar b"}>
          <span style={{ width: `${widthB}%` }} />
        </span>
        <span className={win === "b" ? "compared-value win" : "compared-value"}>
          {compare.b === null ? NO_DATA : compare.format(compare.b)}
        </span>
        {diff !== null && (
          <span className="compared-diff">
            <span className={`country-swatch ${diff.side}`} />
            {diff.text}
          </span>
        )}
      </span>
    </div>
  );
}
