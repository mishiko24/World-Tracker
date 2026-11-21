// Comparison mode: country A (selected) vs country B (compared), drawn in their map colors (--color-a / --color-b,
// red and blue on the dark map). The info panel header is the key: both names with flags, underlined in their
// colors. Every value row is a FactRow with a `compare` spec, drawn as two bars like the Power Level card:
//
//   Population   [red bar ··················] 341.8 M      bars scaled to the larger of the two values
//                [blue bar ··]                 41.3 M
//                ■ 8.3× less                               how B compares to A (blue swatch = B)
//
//   the better value is green           (better = higher, unless better="lower": inflation, government debt;
//                                        better="none" where neither is better: median age, density, age groups)
//   how much more/less, by mode         relative: "8.3× more" from 2× up, else "22% more"
//                                       points: percentage points, for values that are themselves percentages
//                                       score: points of a 0-100 score; years: difference in years
// Red is deliberately not used for "worse": the selected country is red on the map.

import type { CSSProperties } from "react";
import { flagUrl } from "../Flag";

export type Better = "higher" | "lower" | "none";
export type DiffMode = "relative" | "points" | "score" | "years";

export interface Comparison {
  a: number | null;
  b: number | null;
  format: (value: number) => string;
  mode?: DiffMode;
  better?: Better;
}

// Map colors of the two countries, set as CSS variables (--color-a / --color-b) on the info panel.
export interface CompareColors {
  a: string;
  b: string;
}

const RATIO_FROM = 2; // "8.3× more" from twice as much; below that "22% more" reads better than "1.2× more"

// CSS variables on the info panel: --color-a/b (bars, underlines) and --flag-a/b (flag chips in text rows).
export function compareVariables(colors: CompareColors, a: string, b: string | null): CSSProperties {
  return {
    "--color-a": colors.a,
    "--color-b": colors.b,
    "--flag-a": cssImage(a),
    "--flag-b": b === null ? "none" : cssImage(b),
  } as CSSProperties;
}

// Absolute URL: a relative url() inside a CSS variable resolves against the stylesheet (assets/), not the page.
function cssImage(id: string): string {
  return `url(${new URL(flagUrl(id), document.baseURI).href})`;
}

export function winner({ a, b, better = "higher" }: Comparison): "a" | "b" | null {
  if (a === null || b === null || a === b || better === "none") {
    return null;
  }
  return b > a === (better === "higher") ? "b" : "a";
}

// How B compares to A in words ("8.3× more", "0.5 pp lower"), or null when there's nothing to say.
export function difference({ a, b, mode = "relative" }: Comparison): string | null {
  if (a === null || b === null) {
    return null;
  }
  if (a === b) {
    return "same";
  }
  const points = Math.abs(b - a);
  const higher = b > a;
  if (mode === "points") {
    return `${points.toFixed(1)} pp ${higher ? "higher" : "lower"}`;
  }
  if (mode === "score") {
    // From the rounded scores as displayed, so 60 vs 80 reads "20 points", not "19" (60.4 vs 79.6).
    const shown = Math.abs(Math.round(b) - Math.round(a));
    return shown === 0 ? "same" : `${shown} points ${higher ? "higher" : "lower"}`;
  }
  if (mode === "years") {
    return `${points.toFixed(1)} years ${higher ? "more" : "less"}`;
  }
  if (a <= 0 || b <= 0) {
    return null; // ratios of zero or negative values have no meaning
  }
  const ratio = higher ? b / a : a / b;
  if (ratio >= RATIO_FROM) {
    return `${ratio.toLocaleString("en-US", { maximumFractionDigits: ratio < 10 ? 1 : 0 })}× ${higher ? "more" : "less"}`;
  }
  const percent = (points / a) * 100;
  return `${percent.toLocaleString("en-US", { maximumFractionDigits: percent < 10 ? 1 : 0 })}% ${higher ? "more" : "less"}`;
}

// Bar lengths in % of the row width: the larger value fills the row. Negative values get no bar.
export function barWidths({ a, b }: Comparison): [number, number] {
  const max = Math.max(a ?? 0, b ?? 0);
  if (max <= 0) {
    return [0, 0];
  }
  return [(Math.max(a ?? 0, 0) / max) * 100, (Math.max(b ?? 0, 0) / max) * 100];
}
