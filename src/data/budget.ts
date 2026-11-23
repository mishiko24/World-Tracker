// Government budget helpers shared by the info panel (BudgetChart.tsx) and the static pages.

import type { Budget, BudgetFunctionId } from "./countryData";

// Fixed color per function (never by rank), validated as a set on the panel surface (dataviz validator:
// CVD ΔE ≥ 8.4, normal-vision ΔE ≥ 19, contrast ≥ 3:1). The three smallest functions share one neutral slice.
const COLORS: Partial<Record<BudgetFunctionId, string>> = {
  social: "#3987e5",
  health: "#d95926",
  generalPublic: "#199e70",
  education: "#c98500",
  economic: "#d55181",
  defence: "#0ca30c",
  publicOrder: "#9085e9",
};
export const OTHER_COLOR = "#6f6c95";
export const OTHER_FUNCTIONS: BudgetFunctionId[] = ["housing", "recreation", "environment"];

export function budgetColor(id: BudgetFunctionId): string {
  return COLORS[id] ?? OTHER_COLOR;
}

// Share of all spending, percent. Asset sales can make a function slightly negative: the donut shows it as 0.
export function budgetShare(budget: Budget, id: BudgetFunctionId): number {
  return (budget.functions[id] / budget.percentOfGdp) * 100;
}
