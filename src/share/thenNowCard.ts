// "Then and now" share card, 1200x630: how a country changed since 2000 (CountryData.trends).
//
//   header  flag backdrop, name; "2000 → 2024"
//   below   six glass tiles: what, the years | today's value, "from <then> · ▲ change"
// Rising is teal, falling amber (directions, not good or bad: DESIGN.md §5).

import type { CountryData, TrendKey } from "../data/countryData";
import { dollars, percent, shortNumber } from "../ui/info/formatData";
import { DIM, PADDING, TEXT } from "./comparisonCard";
import { measure, text } from "./draw";
import type { CardSide } from "./shareCard";
import { drawCountryFrame, TEXT_X, tile } from "./singleCard";

const WIDTH = 1200;
const UP = "#5eead4";
const DOWN = "#fbbf24";
const MIN_YEARS = 10; // a change over fewer years isn't "then and now"

type Change = "relative" | "points" | "years";

// In order of preference; the first six with data are shown.
const METRICS: { key: TrendKey; label: string; format: (v: number) => string; change: Change }[] = [
  { key: "population", label: "Population", format: shortNumber, change: "relative" },
  { key: "gdp", label: "GDP", format: dollars, change: "relative" },
  { key: "gdpPerCapita", label: "GDP per person", format: dollars, change: "relative" },
  { key: "lifeExpectancy", label: "Life expectancy", format: (v) => `${v.toFixed(1)} years`, change: "years" },
  { key: "electricityAccess", label: "Access to electricity", format: (v) => percent(v, 0), change: "points" },
  { key: "fertility", label: "Children per woman", format: (v) => v.toFixed(2), change: "relative" },
  { key: "gdpPerCapitaPpp", label: "GDP per person (PPP)", format: dollars, change: "relative" },
];

export interface ThenNow {
  label: string;
  thenYear: number;
  nowYear: number;
  then: number;
  now: number;
  format: (v: number) => string;
  change: Change;
}

// The rows the card shows; empty when the country has too little history (then there's no card to offer).
export function thenNowRows(data: CountryData): ThenNow[] {
  return METRICS.flatMap((m) => {
    const points = data.trends[m.key];
    if (points === undefined || points.length < 2) {
      return [];
    }
    const [thenYear, then] = points[0];
    const [nowYear, now] = points[points.length - 1];
    return nowYear - thenYear >= MIN_YEARS ? [{ label: m.label, thenYear, nowYear, then, now, format: m.format, change: m.change }] : [];
  }).slice(0, 6);
}

// "▲ 62%", "▲ 2.3×", "▼ 0.4 pp", "▲ 5.2 years", "no change".
export function changeText(row: ThenNow): string {
  const diff = row.now - row.then;
  const arrow = diff > 0 ? "▲" : "▼";
  if (row.change === "points") {
    return Math.abs(diff) < 0.05 ? "no change" : `${arrow} ${Math.abs(diff).toFixed(1)} pp`;
  }
  if (row.change === "years") {
    return Math.abs(diff) < 0.05 ? "no change" : `${arrow} ${Math.abs(diff).toFixed(1)} years`;
  }
  if (row.then <= 0) {
    return arrow;
  }
  const ratio = row.now / row.then;
  if (ratio >= 2) {
    return `${arrow} ${ratio.toFixed(ratio < 10 ? 1 : 0)}×`;
  }
  const pct = Math.abs(ratio - 1) * 100;
  return pct < 0.5 ? "no change" : `${arrow} ${pct.toFixed(0)}%`;
}

export function drawThenNow(ctx: CanvasRenderingContext2D, side: CardSide, flag: HTMLImageElement, rows: ThenNow[], siteLabel: string): void {
  drawCountryFrame(ctx, side, flag, siteLabel);
  const first = Math.min(...rows.map((r) => r.thenYear));
  const last = Math.max(...rows.map((r) => r.nowYear));
  text(ctx, "THEN AND NOW", TEXT_X, 152, 14, 600, DIM, "left", 0.14);
  text(ctx, `${first} → ${last}`, TEXT_X - 2, 226, 72, 800, TEXT, "left", -0.01);

  const gap = 16;
  const w = (WIDTH - 2 * PADDING - gap) / 2;
  const h = 76;
  rows.forEach((r, i) => {
    const x = PADDING + (i % 2) * (w + gap);
    const y = 300 + Math.floor(i / 2) * (h + 12);
    tile(ctx, x, y, w, h);
    text(ctx, r.label, x + 22, y + 34, 20, 700, TEXT);
    text(ctx, `${r.thenYear} → ${r.nowYear}`, x + 22, y + 58, 15, 500, DIM);
    text(ctx, r.format(r.now), x + w - 22, y + 36, 26, 800, TEXT, "right");
    // "from 282.4 M · ▲ 21%": the change in its direction's color, right-aligned.
    const change = changeText(r);
    const color = r.now > r.then ? UP : r.now < r.then ? DOWN : DIM;
    const changeW = measure(ctx, change, 15, 700);
    text(ctx, change, x + w - 22, y + 60, 15, 700, color, "right");
    text(ctx, `from ${r.format(r.then)} · `, x + w - 22 - changeW, y + 60, 15, 500, DIM, "right");
  });
}
