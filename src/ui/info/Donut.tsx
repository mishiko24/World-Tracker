// A donut of shares with a value in the middle, and a list of rows under it. Hovering a row or a slice
// highlights both and names the slice in the middle. Used by the government budget and trade categories.
// Several rows can share one slice (the budget's small functions share "Other").

import { useState } from "react";
import { percent } from "./formatData";

export interface DonutSlice {
  key: string;
  label: string;
  share: number; // percent; negative shows as 0
  color: string;
}

export interface DonutRow {
  key: string;
  slice: string; // key of the slice it belongs to
  label: string;
  hint: string; // tooltip on the label
  share: string; // formatted
  amount: string; // formatted, may be ""
}

interface DonutProps {
  slices: DonutSlice[];
  rows: DonutRow[];
  center: { value: string; label: string }; // shown when nothing is hovered
  ariaLabel: string;
}

export function Donut({ slices, rows, center, ariaLabel }: DonutProps) {
  const [active, setActive] = useState<string | null>(null);
  const activeSlice = slices.find((s) => s.key === active);
  const colorOf = new Map(slices.map((s) => [s.key, s.color]));

  // Ring of circles with dash offsets; a 2px gap (in the panel color) between slices.
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const shown = slices.map((s) => ({ ...s, share: Math.max(0, s.share) }));
  const sum = shown.reduce((a, s) => a + s.share, 0);
  let offset = 0;
  return (
    <>
      <div className="donut-chart">
        <svg viewBox="0 0 120 120" className="donut" role="img" aria-label={ariaLabel}>
          {shown.map((s) => {
            const length = (s.share / sum) * circumference;
            const dash = Math.max(0, length - 2);
            const circle = (
              <circle
                key={s.key}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={active === s.key ? 18 : 14}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                opacity={active === null || active === s.key ? 1 : 0.35}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
              >
                <title>{`${s.label}: ${percent(s.share)}`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })}
        </svg>
        <div className="donut-center">
          <strong>{activeSlice === undefined ? center.value : percent(activeSlice.share)}</strong>
          <span>{activeSlice === undefined ? center.label : activeSlice.label}</span>
        </div>
      </div>
      <ul className="donut-rows">
        {rows.map((row) => (
          <li
            key={row.key}
            className={active === row.slice ? "active" : active === null ? "" : "dim"}
            onMouseEnter={() => setActive(row.slice)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="donut-swatch" style={{ background: colorOf.get(row.slice) }} />
            <span className="donut-label has-hint" tabIndex={0} data-hint={row.hint}>
              {row.label}
            </span>
            <span className="donut-share">{row.share}</span>
            <span className="donut-amount">{row.amount}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
