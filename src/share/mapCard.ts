// "Share map" image, 1200x630: the world colored by one number (map/colorBy.ts), in the cards' style.
//
//   left   WORLD MAP, the title (what's colored), the color scale with lowest / median / highest, top 5, source
//   right  the whole world, each country in its color; no data = plain land
//
// drawExportMixCard: the same frame for a category map (each country's biggest export category), with a legend.
// drawWorld is also the home card's map (shareCard.ts). pixelRatio 2 draws a 2400x1260 image (Reddit posts).

import { geoMercator, geoPath } from "d3-geo";
import { valueWithUnit } from "../data/rankings";
import type { ColorScale } from "../map/colorBy";
import type { Country } from "../map/geo";
import { heatColor } from "../map/heatColors";
import { background, DIM, TEXT } from "./comparisonCard";
import { measure, text } from "./draw";

const LAND = "#262b63"; // the dark map's land: no data
const BORDER = "rgba(16, 18, 58, 0.9)";

// The world fitted into [x0, y0, x1, y1]; fillOf: a country's color, undefined = no data (plain land).
export function drawWorld(ctx: CanvasRenderingContext2D, countries: Country[], fillOf: (id: string) => string | undefined, box: [number, number, number, number]): void {
  const features = { type: "FeatureCollection" as const, features: countries.map((c) => c.shape) };
  const projection = geoMercator().fitExtent(
    [
      [box[0], box[1]],
      [box[2], box[3]],
    ],
    features,
  );
  const path = geoPath(projection, ctx);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = BORDER;
  for (const country of countries) {
    ctx.beginPath();
    path(country.shape);
    ctx.fillStyle = fillOf(country.id) ?? LAND;
    ctx.fill();
    ctx.stroke();
  }
}

// The color scale bar, lowest to highest.
export function drawScaleBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, heatColor("dark", 0));
  g.addColorStop(0.5, heatColor("dark", 0.5));
  g.addColorStop(1, heatColor("dark", 1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 12, 6);
  ctx.fill();
}

const LEFT = 56;
const COLUMN = 380; // text column width

// Positions on the heat scale (0..1) as fill colors.
export function heatFill(positions: Map<string, number>): (id: string) => string | undefined {
  return (id) => {
    const t = positions.get(id);
    return t === undefined ? undefined : heatColor("dark", t);
  };
}

function cardContext(canvas: HTMLCanvasElement, pixelRatio: number): CanvasRenderingContext2D {
  canvas.width = 1200 * pixelRatio;
  canvas.height = 630 * pixelRatio;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pixelRatio, pixelRatio);
  return ctx;
}

export function drawMapCard(canvas: HTMLCanvasElement, countries: Country[], scale: ColorScale, flags: Map<string, HTMLImageElement>, siteLabel: string, pixelRatio = 1): void {
  const ctx = cardContext(canvas, pixelRatio);
  background(ctx);
  drawWorld(ctx, countries, heatFill(scale.positions), [470, 40, 1185, 600]);

  text(ctx, "WORLD MAP", LEFT, 84, 16, 700, DIM, "left", 0.14);
  const lines = wrap(ctx, scale.column.fullLabel, COLUMN, 46, 800);
  lines.forEach((line, i) => text(ctx, line, LEFT - 2, 136 + i * 50, 46, 800, TEXT));
  let y = 136 + (lines.length - 1) * 50 + 44;

  drawScaleBar(ctx, LEFT, y, COLUMN - 40);
  const value = (v: number) => valueWithUnit(scale.column, v);
  text(ctx, value(scale.min), LEFT, y + 36, 16, 600, DIM);
  text(ctx, value(scale.max), LEFT + COLUMN - 40, y + 36, 16, 600, DIM, "right");
  y += 84;

  // Top 5: rank, flag, name, value.
  scale.ranked.slice(0, 5).forEach((r, i) => {
    const rowY = y + i * 38;
    text(ctx, String(i + 1), LEFT, rowY, 20, 800, i === 0 ? "#f0b84a" : DIM);
    const flag = flags.get(r.id);
    if (flag !== undefined) {
      ctx.drawImage(flag, LEFT + 26, rowY - 17, 28, 21);
    }
    const shown = value(r.value);
    const valueW = measure(ctx, shown, 19, 700);
    const nameMax = COLUMN - 40 - 64 - valueW - 12;
    text(ctx, fit(ctx, r.name, nameMax, 19, 600), LEFT + 64, rowY, 19, 600, TEXT);
    text(ctx, shown, LEFT + COLUMN - 40, rowY, 19, 700, TEXT, "right");
  });

  text(ctx, `${scale.ranked.length} countries · ${scale.group.sources}`, LEFT, 566, 15, 500, DIM);
  text(ctx, "WORLD TRACKER", LEFT, 600, 14, 800, TEXT, "left", 0.14);
  text(ctx, siteLabel, LEFT + measure(ctx, "WORLD TRACKER", 14, 800, 0.14) + 14, 600, 14, 500, "rgba(255, 255, 255, 0.55)");
}

export interface CategoryMap {
  title: string;
  fills: Map<string, string>; // country id -> its category's color
  legend: { label: string; color: string; count: number }[]; // largest count first
  source: string;
}

export function drawCategoryMapCard(canvas: HTMLCanvasElement, countries: Country[], map: CategoryMap, siteLabel: string, pixelRatio = 1): void {
  const ctx = cardContext(canvas, pixelRatio);
  background(ctx);
  drawWorld(ctx, countries, (id) => map.fills.get(id), [470, 40, 1185, 600]);

  text(ctx, "WORLD MAP", LEFT, 84, 16, 700, DIM, "left", 0.14);
  const lines = wrap(ctx, map.title, COLUMN, 46, 800);
  lines.forEach((line, i) => text(ctx, line, LEFT - 2, 136 + i * 50, 46, 800, TEXT));
  const top = 136 + (lines.length - 1) * 50 + 52;
  map.legend.forEach((item, i) => {
    const y = top + i * 34;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(LEFT, y - 15, 18, 18, 4);
    ctx.fill();
    text(ctx, item.label, LEFT + 30, y, 19, 600, TEXT);
    text(ctx, `${item.count}`, LEFT + COLUMN - 40, y, 19, 700, DIM, "right");
  });
  text(ctx, `${map.fills.size} countries · ${map.source}`, LEFT, 566, 15, 500, DIM);
  text(ctx, "WORLD TRACKER", LEFT, 600, 14, 800, TEXT, "left", 0.14);
  text(ctx, siteLabel, LEFT + measure(ctx, "WORLD TRACKER", 14, 800, 0.14) + 14, 600, 14, 500, "rgba(255, 255, 255, 0.55)");
}

// Words into lines no wider than maxWidth (at most 3; the last one is cut with "…").
function wrap(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size: number, weight: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    const next = line === "" ? word : `${line} ${word}`;
    if (measure(ctx, next, size, weight) <= maxWidth || line === "") {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines.length <= 3 ? lines : [...lines.slice(0, 2), fit(ctx, lines.slice(2).join(" "), maxWidth, size, weight)];
}

// The text, cut with "…" to fit maxWidth.
function fit(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size: number, weight: number): string {
  if (measure(ctx, value, size, weight) <= maxWidth) {
    return value;
  }
  let cut = value;
  while (cut.length > 1 && measure(ctx, `${cut}…`, size, weight) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

// Flags (public/flags, vector) of the top 5.
export async function loadTopFlags(scale: ColorScale): Promise<Map<string, HTMLImageElement>> {
  const ids = scale.ranked.slice(0, 5).map((r) => r.id);
  const images = await Promise.all(
    ids.map(async (id) => {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}flags/${id}.svg`;
      await image.decode();
      return [id, image] as const;
    }),
  );
  return new Map(images);
}
