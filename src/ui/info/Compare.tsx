// Comparison mode: country A (selected) and country B (compared) side by side, one column each.
// Columns are headed by CompareColumns (country names with their map colors), and every value row is a FactRow
// with a `compare` spec. In each row:
//   the better value is green           (better = higher, unless better="lower": inflation, government debt;
//                                        better="none" where neither is better: median age, density, age groups)
//   under B's value: its difference from A   relative ("−92%"), percentage points ("+5.2 pp") for values that are
//                                           themselves percentages, or plain points ("+19") for 0-100 scores
// Red is deliberately not used for "worse": the selected country is red on the map.

import type { CSSProperties } from "react";

export type Better = "higher" | "lower" | "none";
export type DiffMode = "relative" | "points" | "score";

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

export function colorVariables(colors: CompareColors): CSSProperties {
  return { "--color-a": colors.a, "--color-b": colors.b } as CSSProperties;
}

export function winner({ a, b, better = "higher" }: Comparison): "a" | "b" | null {
  if (a === null || b === null || a === b || better === "none") {
    return null;
  }
  return b > a === (better === "higher") ? "b" : "a";
}

// B's difference from A, signed ("+" = B has more), or null when there is nothing meaningful to show.
export function difference({ a, b, mode = "relative" }: Comparison): string | null {
  if (a === null || b === null || a === b) {
    return null;
  }
  const sign = b > a ? "+" : "−";
  const points = Math.abs(b - a);
  if (mode === "points") {
    return `${sign}${points.toFixed(1)} pp`;
  }
  if (mode === "score") {
    return `${sign}${points.toFixed(points < 10 ? 1 : 0)}`;
  }
  if (a <= 0 || b < 0) {
    return null; // a relative change from zero or a negative base has no meaning
  }
  const percent = (points / a) * 100;
  return `${sign}${percent.toLocaleString("en-US", { maximumFractionDigits: percent < 10 ? 1 : 0 })}%`;
}

// Column headings over the side-by-side values: [label column] | A | B.
export function CompareColumns({ a, b }: { a: string; b: string }) {
  return (
    <div className="compare-columns">
      <span />
      <span className="compare-column a">
        <span className="country-swatch a" />
        {a}
      </span>
      <span className="compare-column b">
        <span className="country-swatch b" />
        {b}
      </span>
    </div>
  );
}
