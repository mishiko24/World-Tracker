// Share card: a 1200x630 image (the standard link-preview size) of one country or of a comparison, drawn on a canvas.
//
//   one country   singleCard.ts; also "World rankings" (rankingsCard.ts) and "Then and now" (thenNowCard.ts)
//   comparison    the "fight poster": comparisonCard.ts, one card per section (comparisonSections.ts)
//
// Flags and the Outfit font must be loaded first: loadCardAssets.
// Canvas units are card pixels; the canvas is created at exactly CARD_WIDTH x CARD_HEIGHT.

import type { CountryData } from "../data/countryData";
import type { Country } from "../map/geo";
import { background, DIM, drawComparison, TEXT } from "./comparisonCard";
import { text } from "./draw";
import type { WorldRank } from "../data/rankings";
import { comparisonSection, type ComparisonSection } from "./comparisonSections";
import { drawScaleBar, drawWorld } from "./mapCard";
import { drawRankings } from "./rankingsCard";
import { drawSingle } from "./singleCard";
import { drawThenNow, type ThenNow } from "./thenNowCard";
import { drawDonutCard, type DonutCard } from "./donutCard";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;


export interface CardSide {
  country: Country;
  data: CountryData;
}

// Flag images of the card's countries (public/flags, vector: drawn sharp at any size), loaded before drawing (canvas drawing is
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
    image.src = `${import.meta.env.BASE_URL}flags/${id}.svg`;
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

// One country: the overview card. Two countries: the Power Level comparison (link previews use this one).
export function drawShareCard(canvas: HTMLCanvasElement, a: CardSide, b: CardSide | null, flags: CardFlags, siteLabel: string): void {
  if (b === null) {
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    drawSingle(canvas.getContext("2d")!, a, flags.a, siteLabel);
  } else {
    drawComparisonCard(canvas, a, b, flags, comparisonSection("powerLevel", a.data, b.data, new Map()), siteLabel);
  }
}

// A comparison card for any section (comparisonSections.ts).
export function drawComparisonCard(canvas: HTMLCanvasElement, a: CardSide, b: CardSide, flags: CardFlags, section: ComparisonSection, siteLabel: string): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  drawComparison(canvas.getContext("2d")!, a, b, flags, section, siteLabel);
}

// One-country cards besides the overview: the country's best world rankings, and then and now (since 2000).
export function drawRankingsCard(canvas: HTMLCanvasElement, side: CardSide, flag: HTMLImageElement, ranks: WorldRank[], siteLabel: string): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  drawRankings(canvas.getContext("2d")!, side, flag, ranks, siteLabel);
}

export function drawThenNowCard(canvas: HTMLCanvasElement, side: CardSide, flag: HTMLImageElement, rows: ThenNow[], siteLabel: string): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  drawThenNow(canvas.getContext("2d")!, side, flag, rows, siteLabel);
}

export function drawDonutShareCard(canvas: HTMLCanvasElement, side: CardSide, flag: HTMLImageElement, card: DonutCard, siteLabel: string): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  drawDonutCard(canvas.getContext("2d")!, side, flag, card, siteLabel);
}

// suffix: "rankings" or "then-and-now" for those cards.
export function shareFileName(a: Country, b: Country | null, suffix?: string): string {
  return `world-tracker-${a.id}${b === null ? "" : `-vs-${b.id}`}${suffix === undefined ? "" : `-${suffix}`}.png`.toLowerCase();
}

// Home page link preview (index.html, about.html): the world in Power Level colors (same scale as the map's
// "Color countries by: Power Level"), the site name and what it does. powerLevels: id -> 0..1 within the world.
export function drawHomeCard(canvas: HTMLCanvasElement, countries: Country[], powerLevels: Map<string, number>, siteLabel: string): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  background(ctx);

  // The whole map on the right; the text on the left, so no country (the Americas!) sits under the text.
  drawWorld(ctx, countries, powerLevels, [475, 50, 1185, 600]);

  text(ctx, "WORLD TRACKER", 56, 150, 20, 700, DIM, "left", 0.14);
  text(ctx, "Compare any", 52, 228, 58, 800, TEXT);
  text(ctx, "two countries", 52, 292, 58, 800, TEXT);
  text(ctx, "Power Level, economy,", 56, 352, 23, 400, DIM);
  text(ctx, "population, resources and", 56, 384, 23, 400, DIM);
  text(ctx, `energy for ${countries.length} countries`, 56, 416, 23, 400, DIM);

  // Power Level scale.
  drawScaleBar(ctx, 56, 466, 280);
  text(ctx, "Power Level", 56, 502, 17, 500, DIM);
  text(ctx, "low → high", 336, 502, 17, 400, DIM, "right");

  text(ctx, siteLabel, 56, 590, 19, 400, DIM);
}

// ---------- layouts ----------
