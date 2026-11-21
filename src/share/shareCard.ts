// Share card: a 1200x630 image (the standard link-preview size) of one country or of a comparison, drawn on a canvas.
//
//   one country   silhouette | name, Power Level score and rank, pillar bars, key facts
//   comparison    the "fight poster": comparisonCard.ts
//
// One country is drawn in its map color, with its flag next to its name. Flags and the Outfit font must be loaded
// first: loadCardAssets.
// Canvas units are card pixels; the canvas is created at exactly CARD_WIDTH x CARD_HEIGHT.

import { geoMercator, geoPath } from "d3-geo";
import { PILLAR_LABELS, PILLAR_ORDER, type CountryData } from "../data/countryData";
import type { Country } from "../map/geo";
import { heatColor } from "../map/heatColors";
import { drawComparison } from "./comparisonCard";
import { fitFont, measure, text, withAlpha } from "./draw";
import { drawSilhouette } from "./silhouette";
import { dollars, shortNumber } from "../ui/info/formatData";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const BACKGROUND = "#0f1419";
const TEXT = "#e8e6e3";
const DIM = "#9a968f";
const TRACK = "rgba(255, 255, 255, 0.08)";

export interface CardSide {
  country: Country;
  data: CountryData;
  color: string; // the country's map color (selected = A, compared = B)
}

// Flag images of the card's countries (public/flags/large, 480x360), loaded before drawing (canvas drawing is
// synchronous).
export interface CardFlags {
  a: HTMLImageElement;
  b: HTMLImageElement | null;
}

const FONT_WEIGHTS = [600, 700, 800, 900];

// The card's font (public/fonts) and flags. Canvas text silently falls back to another font if Outfit isn't
// loaded yet, so this must finish before drawing.
export async function loadCardAssets(a: CardSide, b: CardSide | null): Promise<CardFlags> {
  await loadCardFonts();
  async function load(id: string): Promise<HTMLImageElement> {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}flags/large/${id}.png`;
    await image.decode();
    return image;
  }
  return { a: await load(a.data.id), b: b === null ? null : await load(b.data.id) };
}

export async function loadCardFonts(): Promise<void> {
  await Promise.all(
    FONT_WEIGHTS.map(async (weight) => {
      const face = new FontFace("Outfit", `url(${import.meta.env.BASE_URL}fonts/outfit-${weight}.woff2)`, { weight: String(weight) });
      document.fonts.add(await face.load());
    }),
  );
}

export function drawShareCard(canvas: HTMLCanvasElement, a: CardSide, b: CardSide | null, flags: CardFlags, siteLabel: string): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  if (b === null) {
    drawSingle(ctx, a, flags.a, siteLabel);
  } else {
    drawComparison(ctx, a, b, flags, siteLabel);
  }
}

export function shareFileName(a: Country, b: Country | null): string {
  return `world-tracker-${a.id}${b === null ? "" : `-vs-${b.id}`}.png`.toLowerCase();
}

// Home page link preview (index.html, about.html): the world in Power Level colors (same scale as the map's
// "Color countries by: Power Level"), the site name and what it does. powerLevels: id -> 0..1 within the world.
export function drawHomeCard(canvas: HTMLCanvasElement, countries: Country[], powerLevels: Map<string, number>, siteLabel: string): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // The whole map on the right; the text on the left, so no country (the Americas!) sits under the text.
  const features = { type: "FeatureCollection" as const, features: countries.map((c) => c.shape) };
  const projection = geoMercator().fitExtent(
    [
      [475, 50],
      [1185, 600],
    ],
    features,
  );
  const path = geoPath(projection, ctx);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "rgba(15, 20, 25, 0.9)";
  for (const country of countries) {
    const t = powerLevels.get(country.id);
    ctx.beginPath();
    path(country.shape);
    ctx.fillStyle = t === undefined ? "#262c35" : heatColor("dark", t);
    ctx.fill();
    ctx.stroke();
  }

  text(ctx, "WORLD TRACKER", 56, 150, 20, 700, DIM, "left", 0.14);
  text(ctx, "Compare any", 52, 228, 58, 800, TEXT);
  text(ctx, "two countries", 52, 292, 58, 800, TEXT);
  text(ctx, "Power Level, economy,", 56, 352, 23, 400, DIM);
  text(ctx, "population, resources and", 56, 384, 23, 400, DIM);
  text(ctx, `energy for ${countries.length} countries`, 56, 416, 23, 400, DIM);

  // Power Level scale.
  const scale = ctx.createLinearGradient(56, 0, 336, 0);
  scale.addColorStop(0, heatColor("dark", 0));
  scale.addColorStop(0.5, heatColor("dark", 0.5));
  scale.addColorStop(1, heatColor("dark", 1));
  ctx.fillStyle = scale;
  ctx.beginPath();
  ctx.roundRect(56, 466, 280, 10, 5);
  ctx.fill();
  text(ctx, "Power Level", 56, 502, 17, 500, DIM);
  text(ctx, "low → high", 336, 502, 17, 400, DIM, "right");

  text(ctx, siteLabel, 56, 590, 19, 400, DIM);
}

// ---------- layouts ----------

function drawSingle(ctx: CanvasRenderingContext2D, side: CardSide, flag: HTMLImageElement, siteLabel: string): void {
  const level = side.data.powerLevel;
  glow(ctx, 300, 300, side.color);
  drawSilhouette(ctx, side.country, side.color, 60, 70, 460, 450);

  const x = 580;
  const right = 1140;
  text(ctx, "WORLD TRACKER", x, 72, 18, 700, DIM, "left", 0.12);
  drawFlag(ctx, flag, x, 98, 60, 45);
  const nameX = x + 60 + 18;
  const nameSize = fitFont(ctx, side.country.name, right - nameX, 64, 700);
  text(ctx, side.country.name, nameX, 140, nameSize, 700, TEXT);

  text(ctx, "POWER LEVEL", x, 196, 18, 600, DIM, "left", 0.1);
  if (level === null) {
    text(ctx, "Not scored", x, 270, 48, 700, DIM);
  } else {
    text(ctx, level.score.toFixed(1), x - 4, 290, 110, 800, TEXT);
    const scoreWidth = measure(ctx, level.score.toFixed(1), 110, 800);
    text(ctx, `#${level.rank}`, x + scoreWidth + 24, 248, 44, 700, TEXT);
    text(ctx, `of ${level.of} countries`, x + scoreWidth + 24, 282, 20, 400, DIM);

    PILLAR_ORDER.forEach((pillar, i) => {
      const y = 340 + i * 34;
      const value = level.pillars[pillar];
      text(ctx, PILLAR_LABELS[pillar], x, y + 7, 20, 400, DIM);
      bar(ctx, 720, y - 5, 340, 12, value ?? 0, side.color, "right");
      text(ctx, value === null ? "—" : value.toFixed(0), right, y + 7, 20, 600, TEXT, "right");
    });
  }

  const facts: [string, string][] = [
    ["Population", side.data.population.total === null ? "—" : shortNumber(side.data.population.total.value)],
    ["GDP", side.data.economy.gdp === null ? "—" : dollars(side.data.economy.gdp.value)],
    ["GDP per person", side.data.economy.gdpPerCapita === null ? "—" : dollars(side.data.economy.gdpPerCapita.value)],
  ];
  facts.forEach(([label, value], i) => {
    const fx = x + i * 190;
    text(ctx, label, fx, 566, 16, 400, DIM);
    text(ctx, value, fx, 594, 22, 700, TEXT);
  });
  text(ctx, siteLabel, 60, 594, 18, 400, DIM);
}

// ---------- drawing helpers ----------

// Flag with rounded corners and a hairline edge (white flags would vanish into a light glow otherwise).
function drawFlag(ctx: CanvasRenderingContext2D, flag: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.clip();
  ctx.drawImage(flag, x, y, w, h);
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Soft circle of the country's color behind its silhouette.
function glow(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300);
  gradient.addColorStop(0, withAlpha(color, 0.22));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - 300, cy - 300, 600, 600);
}

// Horizontal bar for a 0-100 value. grow = "right": fills from the left end; "left": fills from the right end.
function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number, color: string, grow: "left" | "right"): void {
  ctx.fillStyle = TRACK;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  const filled = (w * Math.min(Math.max(value, 0), 100)) / 100;
  if (filled <= 0) {
    return;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(grow === "right" ? x : x + w - filled, y, filled, h, h / 2);
  ctx.fill();
}
