// "World rankings" share card, 1200x630: a country's best placings in the world (src/data/rankings.ts).
//
//   header  flag backdrop, name; "World #1 in 3 rankings" (or "Best world rankings") and how many top 10s
//   below   six glass tiles: rank badge (gold / silver / bronze for 1-3) | what | value, "of 196 countries"

import { valueWithUnit, type WorldRank } from "../data/rankings";
import { DIM, PADDING, TEXT } from "./comparisonCard";
import { fitFont, measure, text } from "./draw";
import type { CardSide } from "./shareCard";
import { drawCountryFrame, TEXT_X, tile } from "./singleCard";

const WIDTH = 1200;
const SHOWN = 6;
const MEDALS = ["#f0b84a", "#cbd5e1", "#d6a06b"]; // #1, #2, #3
const MEDAL_TEXT = "#1a1440";

export function drawRankings(ctx: CanvasRenderingContext2D, side: CardSide, flag: HTMLImageElement, ranks: WorldRank[], siteLabel: string): void {
  drawCountryFrame(ctx, side, flag, siteLabel);

  const firsts = ranks.filter((r) => r.rank === 1).length;
  const topTen = ranks.filter((r) => r.rank <= 10).length;
  if (firsts > 0) {
    const lead = "World ";
    const number = "#1";
    const rest = ` in ${firsts} ${firsts === 1 ? "ranking" : "rankings"}`;
    const x2 = TEXT_X + measure(ctx, lead, 50, 800);
    text(ctx, lead, TEXT_X, 206, 50, 800, TEXT);
    text(ctx, number, x2, 206, 50, 800, MEDALS[0]);
    text(ctx, rest, x2 + measure(ctx, number, 50, 800), 206, 50, 800, TEXT);
  } else {
    text(ctx, "Best world rankings", TEXT_X, 206, 50, 800, TEXT);
  }
  const more = topTen - firsts;
  let sub = `Where ${side.country.name} places highest in the world`;
  if (firsts > 0) {
    sub = more > 0 ? `and top 10 in ${more} more` : "";
  } else if (topTen > 0) {
    sub = `Top 10 in ${topTen} ${topTen === 1 ? "ranking" : "rankings"}`;
  }
  text(ctx, "WORLD RANKINGS", TEXT_X, 152, 14, 600, DIM, "left", 0.14);
  text(ctx, sub, TEXT_X, 244, 20, 500, DIM);

  // Two columns of three tiles.
  const gap = 16;
  const w = (WIDTH - 2 * PADDING - gap) / 2;
  const h = 76;
  ranks.slice(0, SHOWN).forEach((r, i) => {
    const x = PADDING + (i % 2) * (w + gap);
    const y = 300 + Math.floor(i / 2) * (h + 12);
    tile(ctx, x, y, w, h);
    badge(ctx, r.rank, x + 22, y + h / 2);
    const labelX = x + 116;
    const value = valueWithUnit(r.column, r.value);
    const valueW = measure(ctx, value, 24, 800);
    const labelSize = fitFont(ctx, r.column.fullLabel, w - 116 - valueW - 44, 20, 700);
    text(ctx, r.column.fullLabel, labelX, y + 34, labelSize, 700, TEXT);
    text(ctx, `of ${r.of} countries`, labelX, y + 58, 15, 500, DIM);
    text(ctx, value, x + w - 22, y + h / 2 + 9, 24, 800, TEXT, "right");
  });
}

// "#1" in a pill: gold, silver, bronze for the podium, glass after.
function badge(ctx: CanvasRenderingContext2D, rank: number, x: number, cy: number): void {
  const label = `#${rank}`;
  const w = Math.max(72, measure(ctx, label, 28, 900) + 24);
  ctx.fillStyle = rank <= 3 ? MEDALS[rank - 1] : "rgba(255, 255, 255, 0.12)";
  ctx.beginPath();
  ctx.roundRect(x, cy - 22, w, 44, 22);
  ctx.fill();
  text(ctx, label, x + w / 2, cy + 10, 28, 900, rank <= 3 ? MEDAL_TEXT : TEXT, "center");
}
