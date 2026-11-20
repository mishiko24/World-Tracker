// Share card: a 1200x630 image (the standard link-preview size) of one country or of a comparison, drawn on a canvas.
//
//   one country   silhouette | name, Power Level score and rank, pillar bars, key facts
//   comparison    A's silhouette, name, score   VS   B's score, name, silhouette; then a butterfly chart of the
//                 pillars (A's bars grow left, B's grow right) with the higher value of each pair in green
//
// Each country is drawn in its map color. Text uses the system UI font (the site loads no web font).
// Canvas units are card pixels; the canvas is created at exactly CARD_WIDTH x CARD_HEIGHT.

import { geoDistance, geoMercator, geoPath } from "d3-geo";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { PILLAR_LABELS, PILLAR_ORDER, type CountryData } from "../data/countryData";
import type { Country } from "../map/geo";
import { dollars, shortNumber } from "../ui/info/formatData";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

// Parts of a country further than this from its label point are left out of the silhouette,
// so France is drawn without French Guiana and the US without Hawaii.
const MAINLAND_RADIUS_DEGREES = 40;

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const BACKGROUND = "#0f1419";
const TEXT = "#e8e6e3";
const DIM = "#9a968f";
const WIN = "#3fb950";
const TRACK = "rgba(255, 255, 255, 0.08)";

export interface CardSide {
  country: Country;
  data: CountryData;
  color: string; // the country's map color (selected = A, compared = B)
}

export function drawShareCard(canvas: HTMLCanvasElement, a: CardSide, b: CardSide | null, siteLabel: string): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  if (b === null) {
    drawSingle(ctx, a, siteLabel);
  } else {
    drawComparison(ctx, a, b, siteLabel);
  }
}

export function shareFileName(a: Country, b: Country | null): string {
  return `world-tracker-${a.id}${b === null ? "" : `-vs-${b.id}`}.png`.toLowerCase();
}

// ---------- layouts ----------

function drawSingle(ctx: CanvasRenderingContext2D, side: CardSide, siteLabel: string): void {
  const level = side.data.powerLevel;
  glow(ctx, 300, 300, side.color);
  drawSilhouette(ctx, side, 60, 70, 460, 450);

  const x = 580;
  const right = 1140;
  text(ctx, "WORLD TRACKER", x, 72, 18, 700, DIM, "left", 0.12);
  const nameSize = fitFont(ctx, side.country.name, right - x, 64, 700);
  text(ctx, side.country.name, x, 140, nameSize, 700, TEXT);

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

function drawComparison(ctx: CanvasRenderingContext2D, a: CardSide, b: CardSide, siteLabel: string): void {
  const la = a.data.powerLevel;
  const lb = b.data.powerLevel;

  // Color strips on top: left half belongs to A, right half to B.
  ctx.fillStyle = a.color;
  ctx.fillRect(0, 0, CARD_WIDTH / 2, 8);
  ctx.fillStyle = b.color;
  ctx.fillRect(CARD_WIDTH / 2, 0, CARD_WIDTH / 2, 8);
  glow(ctx, 150, 150, a.color);
  glow(ctx, 1050, 150, b.color);

  drawSilhouette(ctx, a, 40, 46, 200, 200);
  drawSilhouette(ctx, b, 960, 46, 200, 200);

  const scoreA = la?.score ?? null;
  const scoreB = lb?.score ?? null;
  headline(ctx, a, 264, "left", scoreA !== null && scoreB !== null && scoreA > scoreB);
  headline(ctx, b, 936, "right", scoreA !== null && scoreB !== null && scoreB > scoreA);

  ctx.beginPath();
  ctx.arc(600, 150, 34, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, "VS", 600, 162, 30, 800, DIM, "center");

  // Butterfly chart of the pillars.
  const barLength = 340;
  PILLAR_ORDER.forEach((pillar, i) => {
    const y = 300 + i * 42;
    const va = la?.pillars[pillar] ?? null;
    const vb = lb?.pillars[pillar] ?? null;
    text(ctx, PILLAR_LABELS[pillar], 600, y + 8, 20, 500, DIM, "center");
    bar(ctx, 520 - barLength, y - 7, barLength, 16, va ?? 0, a.color, "left");
    bar(ctx, 680, y - 7, barLength, 16, vb ?? 0, b.color, "right");
    const aWins = va !== null && vb !== null && va > vb;
    const bWins = va !== null && vb !== null && vb > va;
    text(ctx, va === null ? "—" : va.toFixed(0), 520 - barLength - 18, y + 9, 22, aWins ? 800 : 500, aWins ? WIN : TEXT, "right");
    text(ctx, vb === null ? "—" : vb.toFixed(0), 680 + barLength + 18, y + 9, 22, bWins ? 800 : 500, bWins ? WIN : TEXT, "left");
  });

  text(ctx, "WORLD TRACKER", 40, 600, 18, 700, DIM, "left", 0.12);
  text(ctx, siteLabel, 1160, 600, 18, 400, DIM, "right");
}

// Name, Power Level score and rank of one side of a comparison.
function headline(ctx: CanvasRenderingContext2D, side: CardSide, x: number, align: "left" | "right", wins: boolean): void {
  const level = side.data.powerLevel;
  const nameSize = fitFont(ctx, side.country.name, 290, 40, 700);
  text(ctx, side.country.name, x, 92, nameSize, 700, TEXT, align);
  text(ctx, "POWER LEVEL", x, 128, 15, 600, DIM, align, 0.1);
  text(ctx, level === null ? "—" : level.score.toFixed(1), x, 206, 76, 800, wins ? WIN : TEXT, align);
  text(ctx, level === null ? "Not scored" : `#${level.rank} of ${level.of}`, x, 240, 20, 400, DIM, align);
}

// ---------- drawing helpers ----------

function drawSilhouette(ctx: CanvasRenderingContext2D, side: CardSide, x: number, y: number, w: number, h: number): void {
  const shape = mainland(side.country.shape, side.country.label);
  // Rotating to the country's own longitude keeps Russia and Fiji in one piece across the date line.
  const projection = geoMercator()
    .rotate([-side.country.label[0], 0])
    .fitExtent(
      [
        [x, y],
        [x + w, y + h],
      ],
      shape,
    );
  ctx.beginPath();
  geoPath(projection, ctx)(shape);
  ctx.fillStyle = side.color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.stroke();
}

function mainland(shape: Feature<Polygon | MultiPolygon>, label: [number, number]): Feature<MultiPolygon> {
  const polygons = shape.geometry.type === "Polygon" ? [shape.geometry.coordinates] : shape.geometry.coordinates;
  const radians = (MAINLAND_RADIUS_DEGREES * Math.PI) / 180;
  const near = polygons.filter((polygon) => polygon[0].some((p: Position) => geoDistance(p as [number, number], label) <= radians));
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: near.length > 0 ? near : polygons } };
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

function font(size: number, weight: number): string {
  return `${weight} ${size}px ${FONT}`;
}

function measure(ctx: CanvasRenderingContext2D, value: string, size: number, weight: number): number {
  ctx.font = font(size, weight);
  return ctx.measureText(value).width;
}

// Largest font size (stepping down from `size`, not below 20) at which the text fits in maxWidth.
function fitFont(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size: number, weight: number): number {
  while (size > 20 && measure(ctx, value, size, weight) > maxWidth) {
    size -= 2;
  }
  return size;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
  align: CanvasTextAlign = "left",
  letterSpacingEm = 0,
): void {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = `${letterSpacingEm * size}px`;
  ctx.fillText(value, x, y);
  ctx.letterSpacing = "0px";
}

// "#rrggbb" + alpha -> rgba().
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
