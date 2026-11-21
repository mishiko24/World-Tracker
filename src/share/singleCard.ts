// One-country share card, 1200x630, in the fight poster's style (comparisonCard.ts):
//
//   header  the country's whole flag, darkened, fading in from the left; name, Power Level score and rank
//   below   the six pillars as bars (left) and three key numbers as tiles (right)
//
// The country is A (selected), so its color is A's pink-red.

import { PILLAR_LABELS, PILLAR_ORDER } from "../data/countryData";
import { dollars, shortNumber } from "../ui/info/formatData";
import { A, background, DEEP_A, DIM, fadeHeaderDown, flagBackdrop, HEADER, PADDING, TEXT } from "./comparisonCard";
import { fitFont, layer, measure, text } from "./draw";
import type { CardSide } from "./shareCard";

const WIDTH = 1200;
const TEXT_X = 470; // the text block starts where the flag has faded into the tint
const TRACK = "rgba(255, 255, 255, 0.1)";
const GLASS = "rgba(255, 255, 255, 0.06)";
const GLASS_BORDER = "rgba(255, 255, 255, 0.12)";

export function drawSingle(ctx: CanvasRenderingContext2D, side: CardSide, flag: HTMLImageElement, siteLabel: string): void {
  background(ctx);
  const [header, h] = layer(WIDTH, HEADER);
  flagBackdrop(h, flag, DEEP_A, "left");
  fadeHeaderDown(h);
  ctx.drawImage(header, 0, 0);

  headline(ctx, side);
  pillars(ctx, side);
  facts(ctx, side);

  text(ctx, "WORLD TRACKER", PADDING, 603, 14, 800, TEXT, "left", 0.14);
  text(ctx, siteLabel, WIDTH - PADDING, 603, 14, 500, "rgba(255, 255, 255, 0.55)", "right");
}

function headline(ctx: CanvasRenderingContext2D, side: CardSide): void {
  const level = side.data.powerLevel;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 2;
  const nameSize = fitFont(ctx, side.country.name, WIDTH - PADDING - TEXT_X, 54, 800);
  text(ctx, side.country.name, TEXT_X, 96, nameSize, 800, TEXT);
  ctx.restore();

  ctx.fillStyle = A;
  ctx.beginPath();
  ctx.roundRect(TEXT_X, 112, 64, 5, 2.5);
  ctx.fill();
  text(ctx, "POWER LEVEL", TEXT_X, 152, 14, 600, DIM, "left", 0.14);

  if (level === null) {
    text(ctx, "No score", TEXT_X, 222, 56, 700, DIM);
    text(ctx, "TOO LITTLE DATA", TEXT_X, 256, 14, 600, DIM, "left", 0.14);
    return;
  }
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 4;
  const score = level.score.toFixed(1);
  text(ctx, score, TEXT_X - 4, 252, 110, 800, TEXT, "left", -0.02);
  ctx.restore();
  const rankX = TEXT_X + measure(ctx, score, 110, 800, -0.02) + 24;
  text(ctx, `#${level.rank}`, rankX, 210, 44, 800, TEXT);
  text(ctx, `of ${level.of} countries`, rankX, 244, 18, 500, DIM);
}

// label | bar (0-100) | value, one row per pillar.
function pillars(ctx: CanvasRenderingContext2D, side: CardSide): void {
  const level = side.data.powerLevel;
  if (level === null) {
    return;
  }
  const labelRight = 196;
  const barX = 214;
  const barW = 430;
  PILLAR_ORDER.forEach((pillar, i) => {
    const cy = 330 + i * 37;
    const value = level.pillars[pillar];
    text(ctx, PILLAR_LABELS[pillar], labelRight, cy + 6, 16, 600, "rgba(255, 255, 255, 0.7)", "right", 0.02);
    ctx.fillStyle = TRACK;
    ctx.beginPath();
    ctx.roundRect(barX, cy - 7, barW, 14, 7);
    ctx.fill();
    if (value !== null && value > 0) {
      const length = (barW * Math.min(value, 100)) / 100;
      ctx.fillStyle = A;
      ctx.beginPath();
      ctx.roundRect(barX, cy - 7, length, 14, Math.min(7, length / 2));
      ctx.fill();
    }
    text(ctx, value === null ? "—" : value.toFixed(0), barX + barW + 18, cy + 9, 25, 800, TEXT);
  });
}

// Three key numbers as glass tiles, stacked on the right.
function facts(ctx: CanvasRenderingContext2D, side: CardSide): void {
  const items: [string, string][] = [
    ["Population", side.data.population.total === null ? "No data" : shortNumber(side.data.population.total.value)],
    ["GDP", side.data.economy.gdp === null ? "No data" : dollars(side.data.economy.gdp.value)],
    ["GDP per person", side.data.economy.gdpPerCapita === null ? "No data" : dollars(side.data.economy.gdpPerCapita.value)],
  ];
  const x = 770;
  const w = WIDTH - PADDING - x;
  const h = 64;
  items.forEach(([label, value], i) => {
    const y = 306 + i * (h + 12);
    ctx.fillStyle = GLASS;
    ctx.strokeStyle = GLASS_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 16);
    ctx.fill();
    ctx.stroke();
    text(ctx, label, x + 22, y + h / 2 + 6, 17, 600, "rgba(255, 255, 255, 0.7)");
    text(ctx, value, x + w - 22, y + h / 2 + 10, 28, 800, TEXT, "right");
  });
}
