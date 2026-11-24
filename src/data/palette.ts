// Categorical colors for donuts and their rows (government budget, trade categories), in this fixed order.
// Validated as a set on the panel surface #17144a, in this order (dataviz validator: colour-blind ΔE ≥ 8.4,
// normal-vision ΔE ≥ 19, contrast ≥ 3:1). Reordering can fail the check: re-run the validator first.
// A category keeps its color whatever its rank; anything past 7 shares the neutral OTHER_COLOR.
export const CATEGORY_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9"] as const;
export const OTHER_COLOR = "#6f6c95";
