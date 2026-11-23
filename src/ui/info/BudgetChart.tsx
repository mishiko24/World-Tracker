// Government budget inside the Economy section: what the government spends its money on.
// One country: a donut (share of all spending) with the total in the middle, and a row per function with its
// share and dollar amount; hovering a row or a slice highlights both. Comparing: paired rows, no donuts.

import { useState } from "react";
import { budgetColor, budgetShare, OTHER_COLOR, OTHER_FUNCTIONS } from "../../data/budget";
import { BUDGET_FUNCTIONS, type Budget, type BudgetFunctionId, type NumberFact } from "../../data/countryData";
import { FactRow } from "./FactRow";
import { dollars, percent, roundDollars } from "./formatData";

export function BudgetChart({ budget, other }: { budget: Budget | null; other: Budget | null | undefined }) {
  if (other !== undefined) {
    return <BudgetCompare a={budget} b={other} />;
  }
  if (budget === null) {
    return <FactRow label="Government spending" value={null} />;
  }
  return <BudgetDonut budget={budget} />;
}

function totalFacts(budget: Budget | null): { usd: NumberFact | null; gdp: NumberFact | null } {
  if (budget === null) {
    return { usd: null, gdp: null };
  }
  const base = { year: budget.year, source: budget.source };
  return { usd: budget.totalUsd === null ? null : { ...base, value: budget.totalUsd }, gdp: { ...base, value: budget.percentOfGdp } };
}

function BudgetDonut({ budget }: { budget: Budget }) {
  const [active, setActive] = useState<BudgetFunctionId | "other" | null>(null);
  const total = totalFacts(budget);
  const slices = [
    ...BUDGET_FUNCTIONS.filter((f) => !OTHER_FUNCTIONS.includes(f.id)).map((f) => ({
      key: f.id as BudgetFunctionId | "other",
      label: f.label,
      share: budgetShare(budget, f.id),
      color: budgetColor(f.id),
    })),
    {
      key: "other" as const,
      label: "Other",
      share: OTHER_FUNCTIONS.reduce((sum, id) => sum + budgetShare(budget, id), 0),
      color: OTHER_COLOR,
    },
  ];
  const groupOf = (id: BudgetFunctionId) => (OTHER_FUNCTIONS.includes(id) ? "other" : id);

  // Ring of circles with dash offsets; a 2px gap (in the panel color) between slices.
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const shown = slices.map((s) => ({ ...s, share: Math.max(0, s.share) }));
  const sum = shown.reduce((a, s) => a + s.share, 0);
  let offset = 0;
  return (
    <div className="budget">
      <FactRow
        label="Government spending"
        value={total.usd === null ? `${percent(budget.percentOfGdp, 0)} of GDP` : dollars(total.usd.value)}
        year={budget.year}
        source={budget.source}
        meta={total.usd === null ? undefined : `${percent(budget.percentOfGdp, 0)} of GDP`}
      />
      <div className="budget-chart">
        <svg viewBox="0 0 120 120" className="budget-donut" role="img" aria-label="Share of government spending by function">
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
        <div className="budget-center">
          <strong>{active === null ? percent(budget.percentOfGdp, 0) : percent(slices.find((s) => s.key === active)!.share)}</strong>
          <span>{active === null ? "of GDP" : slices.find((s) => s.key === active)!.label}</span>
        </div>
      </div>
      <ul className="budget-rows">
        {BUDGET_FUNCTIONS.map((f) => {
          const share = budgetShare(budget, f.id);
          const usd = budget.totalUsd === null ? null : (share / 100) * budget.totalUsd;
          const group = groupOf(f.id);
          return (
            <li
              key={f.id}
              className={active === group ? "active" : active === null ? "" : "dim"}
              onMouseEnter={() => setActive(group)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="budget-swatch" style={{ background: budgetColor(f.id) }} />
              <span className="budget-label has-hint" tabIndex={0} data-hint={`${f.about}.`}>
                {f.label}
              </span>
              <span className="budget-share">{percent(share)}</span>
              <span className="budget-usd">{usd === null ? "" : roundDollars(usd)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Paired rows: totals, then each function's share of all spending (no "better": priorities, not scores).
function BudgetCompare({ a, b }: { a: Budget | null; b: Budget | null }) {
  const ta = totalFacts(a);
  const tb = totalFacts(b);
  const shareFact = (budget: Budget | null, id: BudgetFunctionId): NumberFact | null =>
    budget === null ? null : { value: budgetShare(budget, id), year: budget.year, source: budget.source };
  const pct = (v: number) => percent(v);
  return (
    <div className="budget">
      <FactRow
        label="Government spending"
        value={ta.usd === null ? null : dollars(ta.usd.value)}
        year={ta.usd?.year}
        source={ta.usd?.source}
        compare={{ a: ta.usd?.value ?? null, b: tb.usd?.value ?? null, format: dollars, better: "none" }}
      />
      <FactRow
        label="Spending, % of GDP"
        value={ta.gdp === null ? null : pct(ta.gdp.value)}
        year={ta.gdp?.year}
        source={ta.gdp?.source}
        compare={{ a: ta.gdp?.value ?? null, b: tb.gdp?.value ?? null, format: pct, mode: "points", better: "none" }}
      />
      {BUDGET_FUNCTIONS.map((f) => {
        const fa = shareFact(a, f.id);
        const fb = shareFact(b, f.id);
        return (
          <FactRow
            key={f.id}
            label={f.label}
            hint={`${f.about}. Share of all government spending.`}
            value={fa === null ? null : pct(fa.value)}
            year={fa?.year}
            source={fa?.source}
            compare={{ a: fa?.value ?? null, b: fb?.value ?? null, format: pct, mode: "points", better: "none" }}
          />
        );
      })}
    </div>
  );
}
