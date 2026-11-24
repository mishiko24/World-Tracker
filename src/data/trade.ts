// Goods trade categories: the 97 chapters of the Harmonized System (HS, the customs classification behind all
// trade statistics) grouped into 8 categories for the Trade section's donut, lists and maps.

import { CATEGORY_COLORS, OTHER_COLOR } from "./palette.ts";

export const TRADE_GROUPS = [
  { id: "machinery", short: "Machinery", label: "Machinery & electronics", about: "Computers, phones, chips, engines, industrial machines, medical and optical instruments" },
  { id: "fuels", short: "Fuels", label: "Fuels & minerals", about: "Crude oil, refined fuels, natural gas, coal, ores, salt and cement" },
  { id: "vehicles", short: "Vehicles", label: "Vehicles", about: "Cars, trucks, car parts, aircraft, ships and trains" },
  { id: "chemicals", short: "Chemicals", label: "Chemicals & plastics", about: "Medicines, fertilizers, cosmetics, plastics and rubber" },
  { id: "food", short: "Food", label: "Food & farming", about: "Crops, meat, fish, dairy, drinks, tobacco and animal feed" },
  { id: "metals", short: "Metals", label: "Metals & gems", about: "Gold, diamonds, jewellery, iron, steel, copper, aluminium and metal goods" },
  { id: "textiles", short: "Textiles", label: "Textiles & clothing", about: "Clothes, shoes, fabrics, cotton, leather and furs" },
  { id: "other", short: "Other", label: "Other", about: "Wood, paper, stone and glass products, furniture, toys, weapons, art and goods not classified" },
] as const;
export type TradeGroupId = (typeof TRADE_GROUPS)[number]["id"];

// HS chapter (2 digits) -> category. Chapter 77 is reserved (unused) in the HS.
const CHAPTER_RANGES: [from: number, to: number, group: TradeGroupId][] = [
  [1, 24, "food"],
  [25, 27, "fuels"],
  [28, 40, "chemicals"],
  [41, 43, "textiles"],
  [44, 49, "other"],
  [50, 67, "textiles"],
  [68, 70, "other"],
  [71, 83, "metals"],
  [84, 85, "machinery"],
  [86, 89, "vehicles"],
  [90, 92, "machinery"],
  [93, 99, "other"],
];

export function tradeGroupOf(hsCode: string): TradeGroupId {
  const chapter = Number(hsCode.slice(0, 2));
  const range = CHAPTER_RANGES.find(([from, to]) => chapter >= from && chapter <= to);
  if (range === undefined) {
    throw new Error(`HS code ${hsCode}: chapter ${chapter} is not in any trade group`);
  }
  return range[2];
}

// Machinery … textiles take the palette in order; "other" is neutral.
export function tradeColor(id: TradeGroupId): string {
  return id === "other" ? OTHER_COLOR : CATEGORY_COLORS[TRADE_GROUPS.findIndex((g) => g.id === id)];
}
