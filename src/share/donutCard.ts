// Donut share cards, 1200x630, for one country: "Where the money goes" (government budget) and "What it sells"
// (goods exports by category). Same colors as the panel's donuts (src/data/palette.ts).
//
//   header  flag backdrop, name; kicker, big total, one line of context
//   below   donut (left; the biggest slice in the middle) | two columns of four slices, largest first ("Other"
//           last): swatch, name, share, amount. Colors follow the category, not the order.

import { budgetColor, budgetShare, OTHER_FUNCTIONS } from "../data/budget";
import { BUDGET_FUNCTIONS, type Budget, type Trade } from "../data/countryData";
import { OTHER_COLOR } from "../data/palette";
import { TRADE_GROUPS, tradeColor } from "../data/trade";
import { percent, roundDollars } from "../ui/info/formatData";
import { DIM, PADDING, TEXT } from "./comparisonCard";
import { fitFont, measure, text } from "./draw";
import type { CardSide } from "./shareCard";
import { drawCountryFrame, TEXT_X, tile } from "./singleCard";

const WIDTH = 1200;

interface Slice {
  label: string;
  share: number; // percent
  amount: string;
  color: string;
}

export interface DonutCard {
  kicker: string;
  total: string;
  context: string;
  slices: Slice[]; // 8, drawn in this order
}

export function budgetCard(budget: Budget): DonutCard {
  const shared = BUDGET_FUNCTIONS.filter((f) => !OTHER_FUNCTIONS.includes(f.id));
  const amount = (share: number) => (budget.totalUsd === null ? "" : roundDollars((share / 100) * budget.totalUsd));
  const otherShare = OTHER_FUNCTIONS.reduce((sum, id) => sum + budgetShare(budget, id), 0);
  return {
    kicker: "WHERE THE MONEY GOES",
    total: budget.totalUsd === null ? `${percent(budget.percentOfGdp, 0)} of GDP` : roundDollars(budget.totalUsd),
    context: `Government spending in ${budget.year}${budget.totalUsd === null ? "" : ` · ${percent(budget.percentOfGdp, 0)} of GDP`}`,
    slices: [
      ...shared.map((f) => ({ label: f.label, share: budgetShare(budget, f.id), amount: amount(budgetShare(budget, f.id)), color: budgetColor(f.id) })),
      { label: "Other", share: otherShare, amount: amount(otherShare), color: OTHER_COLOR },
    ],
  };
}

export function exportsCard(trade: Trade): DonutCard {
  const top = trade.topExports[0];
  const lead = top === undefined ? "" : ` · top: ${top.name}${top.worldRank <= 3 ? ` (#${top.worldRank} in the world)` : ""}`;
  return {
    kicker: "WHAT IT SELLS",
    total: roundDollars(trade.exports),
    context: `Goods exports in ${trade.year}${lead}`,
    slices: TRADE_GROUPS.map((g) => ({
      label: g.label,
      share: trade.exports === 0 ? 0 : (trade.exportsByGroup[g.id] / trade.exports) * 100,
      amount: roundDollars(trade.exportsByGroup[g.id]),
      color: tradeColor(g.id),
    })),
  };
}

export function drawDonutCard(ctx: CanvasRenderingContext2D, side: CardSide, flag: HTMLImageElement, card: DonutCard, siteLabel: string): void {
  drawCountryFrame(ctx, side, flag, siteLabel);
  text(ctx, card.kicker, TEXT_X, 152, 14, 600, DIM, "left", 0.14);
  text(ctx, card.total, TEXT_X, 210, 56, 800, TEXT);
  const contextSize = fitFont(ctx, card.context, WIDTH - PADDING - TEXT_X, 20, 500);
  text(ctx, card.context, TEXT_X, 248, contextSize, 500, DIM);

  const isOther = (sl: Slice) => sl.color === OTHER_COLOR;
  const slices = [...card.slices].sort((x, y) => Number(isOther(x)) - Number(isOther(y)) || y.share - x.share);
  const cx = PADDING + 120;
  const cy = 428;
  donut(ctx, cx, cy, 104, 30, slices);
  const biggest = slices[0];
  text(ctx, percent(biggest.share, 0), cx, cy + 8, 40, 800, TEXT, "center");
  const nameSize = fitFont(ctx, biggest.label, 150, 15, 600);
  text(ctx, biggest.label, cx, cy + 34, nameSize, 600, DIM, "center");

  // Two columns of four tiles, right of the donut.
  const left = PADDING + 300;
  const gap = 14;
  const w = (WIDTH - PADDING - left - gap) / 2;
  const h = 58;
  slices.forEach((s, i) => {
    const x = left + Math.floor(i / 4) * (w + gap);
    const y = 302 + (i % 4) * (h + 10);
    tile(ctx, x, y, w, h);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.roundRect(x + 18, y + h / 2 - 8, 16, 16, 4);
    ctx.fill();
    const share = percent(s.share);
    const shareW = measure(ctx, share, 24, 800);
    const labelSize = fitFont(ctx, s.label, w - 50 - shareW - 34, 18, 700);
    text(ctx, s.label, x + 46, y + 27, labelSize, 700, TEXT);
    text(ctx, s.amount, x + 46, y + 47, 14, 500, DIM);
    text(ctx, share, x + w - 18, y + h / 2 + 9, 24, 800, TEXT, "right");
  });
}

// Ring of arcs from 12 o'clock, a small gap between slices (negative shares draw as 0).
function donut(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, width: number, slices: Slice[]): void {
  const shares = slices.map((s) => Math.max(0, s.share));
  const sum = shares.reduce((a, b) => a + b, 0);
  const gap = 0.025; // radians
  let angle = -Math.PI / 2;
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  slices.forEach((s, i) => {
    const sweep = (shares[i] / sum) * Math.PI * 2;
    if (sweep > gap) {
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle + gap / 2, angle + sweep - gap / 2);
      ctx.stroke();
    }
    angle += sweep;
  });
}
