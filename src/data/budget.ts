// Government budget helpers shared by the info panel (BudgetChart.tsx) and the static pages.

import { BUDGET_FUNCTIONS, type Budget, type BudgetFunctionId } from "./countryData";
import { CATEGORY_COLORS, OTHER_COLOR } from "./palette";

// The three smallest functions share one neutral slice ("Other"); the other 7 take the palette in order.
export const OTHER_FUNCTIONS: BudgetFunctionId[] = ["housing", "recreation", "environment"];
const COLORED = BUDGET_FUNCTIONS.filter((f) => !OTHER_FUNCTIONS.includes(f.id));

export function budgetColor(id: BudgetFunctionId): string {
  const index = COLORED.findIndex((f) => f.id === id);
  return index === -1 ? OTHER_COLOR : CATEGORY_COLORS[index];
}

// Share of all spending, percent. Asset sales can make a function slightly negative: the donut shows it as 0.
export function budgetShare(budget: Budget, id: BudgetFunctionId): number {
  return (budget.functions[id] / budget.percentOfGdp) * 100;
}
