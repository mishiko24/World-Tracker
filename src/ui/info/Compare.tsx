// Comparison chip shown next to country A's value: country B's value, an arrow and the difference.
//
//   ▲ green / ▼ red   B is better / worse than A (better = higher, unless `better="lower"`)
//   arrow direction   always the amount: ▲ = B has more, ▼ = B has less
//   difference        relative to A ("52%"), or percentage points ("5.2 pp") for values that are
//                     themselves percentages (growth, inflation, shares), where relative % misleads
//
// Where "more" is worse (inflation, government debt) pass better="lower".

export type Better = "higher" | "lower";
export type DiffMode = "relative" | "points";

interface CompareProps {
  a: number | null;
  b: number | null;
  format: (value: number) => string;
  mode?: DiffMode;
  better?: Better;
}

function relativeDifference(a: number, b: number): string | null {
  if (a <= 0 || b < 0) {
    return null; // a relative change from zero or a negative base has no meaning
  }
  const percent = Math.abs(((b - a) / a) * 100);
  return `${percent.toLocaleString("en-US", { maximumFractionDigits: percent < 10 ? 1 : 0 })}%`;
}

export function Compare({ a, b, format, mode = "relative", better = "higher" }: CompareProps) {
  if (b === null) {
    return <span className="compare neutral">no data</span>;
  }
  if (a === null || a === b) {
    return <span className="compare neutral">{format(b)}</span>;
  }
  const up = b > a;
  const good = up === (better === "higher");
  const difference = mode === "points" ? `${Math.abs(b - a).toFixed(1)} pp` : relativeDifference(a, b);
  return (
    <span className={good ? "compare good" : "compare bad"}>
      {up ? "▲" : "▼"}
      {difference !== null && ` ${difference}`} {format(b)}
    </span>
  );
}
