// Trend charts in the info panel. A value row with history (CountryData.trends) gets a small chart icon on its
// label; clicking it opens a line chart under the row (useTrend). In comparison mode the chart has both countries'
// lines in their map colors (--color-a / --color-b).
//   point at the chart       readout shows that year's values (otherwise the latest year)
//   press and drag across it measure: the span is shaded and the readout shows the change between its ends
//                            (like Google Finance); it stays until the next click/tap on the chart. On touch,
//                            a sideways drag measures, an up/down drag still scrolls the panel.
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
  // how a measured change reads: relative "+6.2%" (default), percentage points for values that are themselves
  // percentages (growth, inflation, access), years for life expectancy
  change?: "relative" | "points" | "years";
}

// Chart input for one number: this country's history, and the compared country's in comparison mode.
const CHANGE_MODE: Partial<Record<TrendKey, TrendInput["change"]>> = {
  growth: "points",
  inflation: "points",
  electricityAccess: "points",
  lifeExpectancy: "years",
};

export function trendOf(key: TrendKey, trends: Trends, other: CountryData | null, format: (value: number) => string): TrendInput {
  return { a: trends[key], b: other?.trends[key], comparing: other !== null, format, change: CHANGE_MODE[key] ?? "relative" };
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

interface Measure {
  from: number; // year where the drag started
  to: number; // year under the pointer now / where it ended
  dragging: boolean;
}

function TrendChart({ a, b, comparing, format, change = "relative" }: TrendInput) {
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [measure, setMeasure] = useState<Measure | null>(null);
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
  const span = measure !== null && measure.from !== measure.to ? { from: Math.min(measure.from, measure.to), to: Math.max(measure.from, measure.to) } : null;

  function yearAt(e: PointerEvent<SVGSVGElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const year = Math.round(x0 + ((svgX - PAD.left) / (W - PAD.left - PAD.right)) * (x1 - x0));
    return Math.min(Math.max(year, x0), x1);
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const year = yearAt(e);
    setMeasure({ from: year, to: year, dragging: true });
    setHoverYear(year);
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const year = yearAt(e);
    setHoverYear(year);
    if (measure?.dragging) {
      setMeasure({ ...measure, to: year });
    }
  }

  // A press without a drag (from = to) clears the measurement.
  function onPointerUp() {
    if (measure !== null) {
      setMeasure(measure.from === measure.to ? null : { ...measure, dragging: false });
    }
  }

  return (
    <div className="trend">
      {span === null ? (
        <div className="trend-readout">
          <span className="trend-year">{shownYear}</span>
          <Readout value={at(a)} format={format} side={comparing ? "a" : "single"} />
          {comparing && <Readout value={at(b)} format={format} side="b" />}
        </div>
      ) : (
        <div className="trend-readout measuring">
          <span className="trend-year">
            {span.from} → {span.to}
          </span>
          <ChangeReadout points={a} span={span} format={format} change={change} side={comparing ? "a" : "single"} />
          {comparing && <ChangeReadout points={b} span={span} format={format} change={change} side="b" />}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="trend-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setMeasure(null)}
        onPointerLeave={() => setHoverYear(null)}
      >
        {span !== null && <rect x={x(span.from)} width={x(span.to) - x(span.from)} y={PAD.top} height={H - PAD.top - PAD.bottom} className="trend-span" />}
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
        {hoverYear !== null && span === null && <line x1={x(hoverYear)} x2={x(hoverYear)} y1={PAD.top} y2={H - PAD.bottom} className="trend-cursor" />}
        {a !== undefined && <path d={path(a)} className={comparing ? "trend-line a" : "trend-line single"} />}
        {comparing && b !== undefined && <path d={path(b)} className="trend-line b" />}
        {span !== null &&
          [a, comparing ? b : undefined].map((points, i) =>
            endpoints(points, span).map(([year, value]) => (
              <circle key={`${i}-${year}`} cx={x(year)} cy={y(value)} r={3} className={`trend-end ${comparing ? (i === 0 ? "a" : "b") : "single"}`} />
            )),
          )}
      </svg>
      {span === null && <p className="trend-hint">Drag across the chart to measure a change</p>}
    </div>
  );
}

// The measured span's two ends on one line: first point at or after span.from, last at or before span.to
// (years can have gaps). Empty when the line has fewer than two points in the span.
function endpoints(points: TrendPoint[] | undefined, span: { from: number; to: number }): TrendPoint[] {
  const inSpan = (points ?? []).filter((p) => p[0] >= span.from && p[0] <= span.to);
  return inSpan.length < 2 ? [] : [inSpan[0], inSpan[inSpan.length - 1]];
}

// Change between the span's two ends (see endpoints).
function ChangeReadout(props: {
  points: TrendPoint[] | undefined;
  span: { from: number; to: number };
  format: (v: number) => string;
  change: NonNullable<TrendInput["change"]>;
  side: "a" | "b" | "single";
}) {
  const { points, span, format, change, side } = props;
  const ends = endpoints(points, span);
  if (ends.length === 0) {
    return (
      <span className="trend-value">
        <span className={`trend-swatch ${side}`} />—
      </span>
    );
  }
  const [start, end] = [ends[0][1], ends[1][1]];
  const diff = end - start;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const amount =
    change === "points"
      ? `${sign}${Math.abs(diff).toFixed(1)} pp`
      : change === "years"
        ? `${sign}${Math.abs(diff).toFixed(1)} years`
        : start > 0
          ? `${sign}${Math.abs((diff / start) * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
          : `${sign}${format(Math.abs(diff))}`;
  return (
    <span className="trend-value">
      <span className={`trend-swatch ${side}`} />
      <span className="trend-from-to">
        {format(start)} → {format(end)}
      </span>
      <span className={diff > 0 ? "trend-change up" : diff < 0 ? "trend-change down" : "trend-change"}>
        {diff > 0 ? "▲" : diff < 0 ? "▼" : ""} {amount}
      </span>
    </span>
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
