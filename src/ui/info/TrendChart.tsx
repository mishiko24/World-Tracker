// Trend charts in the info panel. A value row with history (CountryData.trends) gets a small chart icon on its
// label; clicking it opens a line chart under the row (useTrend). In comparison mode the chart has both countries'
// lines in their map colors (--color-a / --color-b). Pointing at the chart reads out that year's values; otherwise
// the readout shows the latest year.
// Plain SVG, no chart library: one line or two, three value gridlines, first and last year.

import { useState, type PointerEvent, type ReactNode } from "react";
import type { CountryData, TrendKey, TrendPoint, Trends } from "../../data/countryData";

const W = 320; // viewBox units; the SVG scales to the panel width
const H = 130;
const PAD = { left: 52, right: 8, top: 8, bottom: 18 };

export interface TrendInput {
  a: TrendPoint[] | undefined;
  b: TrendPoint[] | undefined; // compared country; undefined when not comparing or no history
  comparing: boolean;
  format: (value: number) => string;
}

// Chart input for one number: this country's history, and the compared country's in comparison mode.
export function trendOf(key: TrendKey, trends: Trends, other: CountryData | null, format: (value: number) => string): TrendInput {
  return { a: trends[key], b: other?.trends[key], comparing: other !== null, format };
}

// Wraps any value row: `row` gets the label to show (a toggle when there's history), the chart opens under it.
export function TrendRow({ label, trend, row }: { label: string; trend: TrendInput | undefined; row: (label: ReactNode) => ReactNode }) {
  const t = useTrend(label, trend);
  return (
    <>
      {row(t.label)}
      {t.chart}
    </>
  );
}

// A row's label and its chart: label becomes a toggle when there's history to show (at least 2 years).
export function useTrend(label: string, input: TrendInput | undefined): { label: ReactNode; chart: ReactNode } {
  const [open, setOpen] = useState(false);
  const usable = (s: TrendPoint[] | undefined) => s !== undefined && s.length > 1;
  if (input === undefined || !(usable(input.a) || usable(input.b))) {
    return { label, chart: null };
  }
  return {
    label: (
      <button className={open ? "trend-toggle open" : "trend-toggle"} onClick={() => setOpen(!open)} title={open ? "Hide trend" : "Show trend since 2000"}>
        {label}
        <TrendIcon />
      </button>
    ),
    chart: open ? <TrendChart {...input} /> : null,
  };
}

function TrendIcon() {
  return (
    <svg className="trend-icon" viewBox="0 0 16 16" aria-hidden="true">
      <polyline points="1,12 5,7 9,9 15,3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendChart({ a, b, comparing, format }: TrendInput) {
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const series = [a ?? [], b ?? []];
  const all = series.flat();
  const years = all.map((p) => p[0]);
  const values = all.map((p) => p[1]);
  const [x0, x1] = [Math.min(...years), Math.max(...years)];
  let [y0, y1] = [Math.min(...values), Math.max(...values)];
  if (y0 === y1) {
    [y0, y1] = [y0 - 1, y1 + 1]; // flat line: give it some room
  }
  const margin = (y1 - y0) * 0.08;
  [y0, y1] = [y0 - margin, y1 + margin];

  const x = (year: number) => PAD.left + ((year - x0) / Math.max(x1 - x0, 1)) * (W - PAD.left - PAD.right);
  const y = (value: number) => PAD.top + (1 - (value - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);
  const path = (points: TrendPoint[]) => points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const ticks = [y1 - margin, (y0 + y1) / 2, y0 + margin];

  const shownYear = hoverYear ?? x1;
  const at = (points: TrendPoint[] | undefined) => points?.find((p) => p[0] === shownYear)?.[1] ?? null;

  function pointAt(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const year = Math.round(x0 + ((svgX - PAD.left) / (W - PAD.left - PAD.right)) * (x1 - x0));
    setHoverYear(Math.min(Math.max(year, x0), x1));
  }

  return (
    <div className="trend">
      <div className="trend-readout">
        <span className="trend-year">{shownYear}</span>
        <Readout value={at(a)} format={format} side={comparing ? "a" : "single"} />
        {comparing && <Readout value={at(b)} format={format} side="b" />}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" onPointerMove={pointAt} onPointerDown={pointAt} onPointerLeave={() => setHoverYear(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="trend-grid" />
            <text x={PAD.left - 6} y={y(t) + 3} className="trend-axis" textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 4} className="trend-axis">
          {x0}
        </text>
        <text x={W - PAD.right} y={H - 4} className="trend-axis" textAnchor="end">
          {x1}
        </text>
        {hoverYear !== null && <line x1={x(hoverYear)} x2={x(hoverYear)} y1={PAD.top} y2={H - PAD.bottom} className="trend-cursor" />}
        {a !== undefined && <path d={path(a)} className={comparing ? "trend-line a" : "trend-line single"} />}
        {comparing && b !== undefined && <path d={path(b)} className="trend-line b" />}
      </svg>
    </div>
  );
}

function Readout({ value, format, side }: { value: number | null; format: (v: number) => string; side: "a" | "b" | "single" }) {
  return (
    <span className="trend-value">
      <span className={`trend-swatch ${side}`} />
      {value === null ? "—" : format(value)}
    </span>
  );
}
