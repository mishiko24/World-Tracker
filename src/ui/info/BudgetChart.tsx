// Government budget inside the Economy section: what the government spends its money on.
// One country: a donut (share of all spending) with spending as % of GDP in the middle, and a row per function
// with its share and dollar amount (Donut.tsx). Comparing: paired rows, no donuts.

import { budgetColor, budgetShare, OTHER_FUNCTIONS } from "../../data/budget";
import { BUDGET_FUNCTIONS, type Budget, type BudgetFunctionId, type NumberFact } from "../../data/countryData";
import { OTHER_COLOR } from "../../data/palette";
import { Donut, type DonutRow, type DonutSlice } from "./Donut";
import { FactRow, tooltipText } from "./FactRow";
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
  const total = totalFacts(budget);
  const slices: DonutSlice[] = [
    ...BUDGET_FUNCTIONS.filter((f) => !OTHER_FUNCTIONS.includes(f.id)).map((f) => ({
      key: f.id as string,
      label: f.label,
      share: budgetShare(budget, f.id),
      color: budgetColor(f.id),
    })),
    { key: "other", label: "Other", share: OTHER_FUNCTIONS.reduce((sum, id) => sum + budgetShare(budget, id), 0), color: OTHER_COLOR },
  ];
  const rows: DonutRow[] = BUDGET_FUNCTIONS.map((f) => {
    const share = budgetShare(budget, f.id);
    return {
      key: f.id,
      slice: OTHER_FUNCTIONS.includes(f.id) ? "other" : f.id,
      label: f.label,
      hint: tooltipText(`${f.about}.`, budget.year, budget.source)!,
      share: percent(share),
      amount: budget.totalUsd === null ? "" : roundDollars((share / 100) * budget.totalUsd),
    };
  });
  return (
    <div className="budget">
      <FactRow
        label="Government spending"
        value={total.usd === null ? `${percent(budget.percentOfGdp, 0)} of GDP` : dollars(total.usd.value)}
        year={budget.year}
        source={budget.source}
        meta={total.usd === null ? undefined : `${percent(budget.percentOfGdp, 0)} of GDP`}
      />
      <Donut
        slices={slices}
        rows={rows}
        center={{ value: percent(budget.percentOfGdp, 0), label: "of GDP" }}
        ariaLabel="Share of government spending by function"
      />
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
