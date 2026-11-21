// Comparison share card ("fight poster"), 1200x630:
//
//   header      A's flag fades in from the left, B's from the right, split by a diagonal; both whole and darkened
//               (they are backgrounds). Names, Power Level scores and ranks meet at the VS badge in the middle.
//   scoreboard  "categories won" tally, then one row per Power Level pillar:
//               A's bar | A's value | pillar | B's value | B's bar
//               Bars share one 0-100 scale and grow outward. The winner's value is a teal pill, its bar is solid
//               with the gap ("+54") at its end; the loser's bar is dimmer.
//
// Colors are the card's own (A pink-red, B sky blue, as everywhere: red = A, blue = B; teal = better), not the map
// colors, so every card looks the same whatever map style the sharer uses.

import { PILLAR_LABELS, PILLAR_ORDER, type PillarId } from "../data/countryData";
import { fadeOut, fitFont, layer, measure, mix, text, withAlpha } from "./draw";
import type { CardFlags, CardSide } from "./shareCard";

const WIDTH = 1200;
const HEIGHT = 630;
// The card palette (theme.css has the same values for the site).
export const A = "#ff5c8a";
const B = "#4cc9ff";
const WIN = "#5eead4";
const WIN_TEXT = "#082a30";
export const DEEP_A = "#2c0a1c"; // header tint behind A's flag
const DEEP_B = "#061c38";
const LOSER_MIX = "#241c5c"; // a losing bar = its color mixed into this
export const TEXT = "#ffffff";
const SOFT = "rgba(255, 255, 255, 0.85)";
export const DIM = "rgba(255, 255, 255, 0.6)";
export const PADDING = 48;

export const HEADER = 300; // header height; it fades out into the card over its lower half
const FLAG_H = HEADER * 0.86;
const FLAG_W = (FLAG_H * 4) / 3;
const VS = { x: WIDTH / 2, y: 137, r: 37 };

export function drawComparison(ctx: CanvasRenderingContext2D, a: CardSide, b: CardSide, flags: CardFlags, siteLabel: string): void {
  background(ctx);
  ctx.drawImage(header(flags), 0, 0);

  const la = a.data.powerLevel;
  const lb = b.data.powerLevel;
  const sa = la?.score ?? null;
  const sb = lb?.score ?? null;
  headline(ctx, a, "left", sa !== null && sb !== null && sa > sb);
  headline(ctx, b, "right", sa !== null && sb !== null && sb > sa);
  vsBadge(ctx);

  const pillars = PILLAR_ORDER.map((p) => ({ id: p, a: la?.pillars[p] ?? null, b: lb?.pillars[p] ?? null }));
  tally(ctx, pillars);
  pillars.forEach((p, i) => row(ctx, p, 339 + i * 37));

  text(ctx, "WORLD TRACKER", PADDING, 603, 14, 800, TEXT, "left", 0.14);
  text(ctx, siteLabel, WIDTH - PADDING, 603, 14, 500, "rgba(255, 255, 255, 0.55)", "right");
}

// ---------- header ----------

export function background(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  g.addColorStop(0, "#1a0a3d");
  g.addColorStop(0.55, "#141d5e");
  g.addColorStop(1, "#08325e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

// Both halves, faded out downward into the card.
function header(flags: CardFlags): HTMLCanvasElement {
  const [canvas, ctx] = layer(WIDTH, HEADER);
  half(ctx, flags.a, DEEP_A, "left");
  half(ctx, flags.b!, DEEP_B, "right");
  fadeHeaderDown(ctx);
  return canvas;
}

// One side of the comparison header: clipped to its half of the diagonal (54% at the top, 46% at the bottom).
function half(ctx: CanvasRenderingContext2D, flag: HTMLImageElement, deep: string, side: "left" | "right"): void {
  ctx.save();
  ctx.beginPath();
  if (side === "left") {
    ctx.moveTo(0, 0);
    ctx.lineTo(WIDTH * 0.54, 0);
    ctx.lineTo(WIDTH * 0.46, HEADER);
    ctx.lineTo(0, HEADER);
  } else {
    ctx.moveTo(WIDTH * 0.54, 0);
    ctx.lineTo(WIDTH, 0);
    ctx.lineTo(WIDTH, HEADER);
    ctx.lineTo(WIDTH * 0.46, HEADER);
  }
  ctx.closePath();
  ctx.clip();
  flagBackdrop(ctx, flag, deep, side);
  ctx.restore();
}

// A flag as a header backdrop (both cards): the tint, a big blurred copy of the flag whose colors bleed slowly
// into the tint, the sharp whole flag on top at the outer edge (only its inner edge and bottom feathered), then
// the tint again far from the flag. Darkened throughout: it's a background. Draws over the whole header width;
// clip first to limit it.
export function flagBackdrop(ctx: CanvasRenderingContext2D, flag: HTMLImageElement, deep: string, side: "left" | "right"): void {
  const left = side === "left";
  ctx.fillStyle = deep;
  ctx.fillRect(0, 0, WIDTH, HEADER);

  // Halo: the flag enlarged by 80px, blurred 60px, darkened.
  const haloW = FLAG_W + 80;
  ctx.filter = "blur(60px) brightness(0.38) saturate(1.1)";
  ctx.drawImage(flag, left ? -40 : WIDTH - haloW + 40, -40, haloW, FLAG_H + 80);
  ctx.filter = "none";

  // Sharp flag, darkened, feathered on its inner edge (last 26%) and bottom (last 30%).
  const [flagLayer, f] = layer(Math.ceil(FLAG_W), Math.ceil(FLAG_H));
  f.filter = "brightness(0.42) saturate(0.85)";
  f.drawImage(flag, 0, 0, FLAG_W, FLAG_H);
  f.filter = "none";
  const inward = left ? f.createLinearGradient(0, 0, FLAG_W, 0) : f.createLinearGradient(FLAG_W, 0, 0, 0);
  inward.addColorStop(0.74, "#000");
  inward.addColorStop(1, "rgba(0, 0, 0, 0)");
  fadeOut(f, inward);
  const down = f.createLinearGradient(0, 0, 0, FLAG_H);
  down.addColorStop(0.7, "#000");
  down.addColorStop(1, "rgba(0, 0, 0, 0)");
  fadeOut(f, down);
  ctx.drawImage(flagLayer, left ? 0 : WIDTH - FLAG_W, 0);

  // Tint returns away from the flag, so the halo doesn't reach the text.
  const outer = left ? 0 : WIDTH;
  const dir = left ? 1 : -1;
  const tint = ctx.createLinearGradient(outer, 0, outer + dir * FLAG_W * 1.35, 0);
  tint.addColorStop(0.59, withAlpha(deep, 0));
  tint.addColorStop(1, withAlpha(deep, 0.8));
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, WIDTH, HEADER);
}

// Fades the header out downward into the card (both cards).
export function fadeHeaderDown(ctx: CanvasRenderingContext2D): void {
  const down = ctx.createLinearGradient(0, 0, 0, HEADER);
  down.addColorStop(0.55, "#000");
  down.addColorStop(1, "rgba(0, 0, 0, 0)");
  fadeOut(ctx, down);
}

// Name, color key line, score and rank. Left side is right-aligned against the VS badge, right side left-aligned.
function headline(ctx: CanvasRenderingContext2D, side: CardSide, align: "left" | "right", wins: boolean): void {
  const left = align === "left";
  const gap = 30;
  const x = left ? VS.x - VS.r - gap : VS.x + VS.r + gap;
  const textAlign = left ? "right" : "left";
  const level = side.data.powerLevel;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 2;
  const room = left ? x - PADDING : WIDTH - PADDING - x;
  const nameSize = fitFont(ctx, side.country.name, room, 38, 800);
  text(ctx, side.country.name, x, 86, nameSize, 800, TEXT, textAlign);
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 4;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  if (level === null) {
    text(ctx, "No score", x, 176, 40, 700, DIM, textAlign);
  } else {
    text(ctx, level.score.toFixed(1), x + (left ? 4 : -4), 190, 90, 800, wins ? WIN : TEXT, textAlign, -0.02);
  }
  ctx.restore();

  ctx.fillStyle = left ? A : B;
  ctx.beginPath();
  ctx.roundRect(left ? x - 64 : x, 98, 64, 5, 2.5);
  ctx.fill();
  text(ctx, level === null ? "TOO LITTLE DATA" : `#${level.rank} · POWER LEVEL`, x, 216, 14, 600, DIM, textAlign, 0.14);
}

function vsBadge(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.shadowColor = "rgba(120, 90, 255, 0.35)";
  ctx.shadowBlur = 34;
  const ring = ctx.createLinearGradient(VS.x - VS.r, VS.y - VS.r, VS.x + VS.r, VS.y + VS.r);
  ring.addColorStop(0, A);
  ring.addColorStop(1, B);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(VS.x, VS.y, VS.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#120c33";
  ctx.beginPath();
  ctx.arc(VS.x, VS.y, VS.r - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "italic 900 31px Outfit, system-ui, sans-serif";
  ctx.fillStyle = TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", VS.x, VS.y + 1);
  ctx.textBaseline = "alphabetic";
}

// ---------- scoreboard ----------

interface PillarPair {
  id: PillarId;
  a: number | null;
  b: number | null;
}

// "1  CATEGORIES WON  5", counted over pillars both countries have. Left out when they share none.
function tally(ctx: CanvasRenderingContext2D, pillars: PillarPair[]): void {
  const both = pillars.filter((p) => p.a !== null && p.b !== null);
  if (both.length === 0) {
    return;
  }
  const wonA = String(both.filter((p) => Math.round(p.a!) > Math.round(p.b!)).length);
  const wonB = String(both.filter((p) => Math.round(p.b!) > Math.round(p.a!)).length);
  const label = "CATEGORIES WON";
  const gap = 14;
  const labelW = measure(ctx, label, 13, 700, 0.16);
  const y = 298;
  text(ctx, wonA, WIDTH / 2 - labelW / 2 - gap, y, 30, 900, A, "right");
  text(ctx, label, WIDTH / 2, y - 4, 13, 700, DIM, "center", 0.16);
  text(ctx, wonB, WIDTH / 2 + labelW / 2 + gap, y, 30, 900, B, "left");
}

// Column layout (centered): bar 340 | pill 72 | label 150 | pill 72 | bar 340, 10px gaps.
const BAR = 340;
const COLUMNS = {
  barA: [93, 433],
  pillA: 479, // centers
  label: 600,
  pillB: 721,
  barB: [767, 1107],
};

// Values are compared as shown (rounded), so a "win" is never between two equal-looking numbers.
function row(ctx: CanvasRenderingContext2D, p: PillarPair, y: number): void {
  const ra = p.a === null ? null : Math.round(p.a);
  const rb = p.b === null ? null : Math.round(p.b);
  const aWins = ra !== null && rb !== null && ra > rb;
  const bWins = ra !== null && rb !== null && rb > ra;
  const diff = ra !== null && rb !== null ? Math.abs(ra - rb) : 0;

  text(ctx, PILLAR_LABELS[p.id], COLUMNS.label, y + 6, 16, 600, "rgba(255, 255, 255, 0.7)", "center", 0.02);
  pill(ctx, ra, COLUMNS.pillA, y, aWins);
  pill(ctx, rb, COLUMNS.pillB, y, bWins);
  if (ra !== null) {
    bar(ctx, ra, aWins, A, "left", y, diff);
  }
  if (rb !== null) {
    bar(ctx, rb, bWins, B, "right", y, diff);
  }
}

function pill(ctx: CanvasRenderingContext2D, value: number | null, cx: number, cy: number, wins: boolean): void {
  const label = value === null ? "—" : String(value);
  if (wins) {
    const w = Math.max(64, measure(ctx, label, 25, 800) + 22);
    ctx.fillStyle = WIN;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - 17, w, 34, 17);
    ctx.fill();
  }
  text(ctx, label, cx, cy + 9, 25, 800, wins ? WIN_TEXT : SOFT, "center");
}

// A's bar grows left from the pill, B's grows right. Winner: solid, gap at the end; loser: dimmer.
function bar(ctx: CanvasRenderingContext2D, value: number, wins: boolean, color: string, side: "left" | "right", cy: number, diff: number): void {
  const length = (BAR * Math.min(Math.max(value, 0), 100)) / 100;
  if (length > 0) {
    const h = 14;
    const x = side === "left" ? COLUMNS.barA[1] - length : COLUMNS.barB[0];
    ctx.fillStyle = wins ? color : mix(color, 0.52, LOSER_MIX);
    ctx.beginPath();
    const outer = Math.min(7, length / 2); // short bars: corners can't be rounder than the bar is long
    const inner = Math.min(3, length / 2);
    ctx.roundRect(x, cy - h / 2, length, h, side === "left" ? [outer, inner, inner, outer] : [inner, outer, outer, inner]);
    ctx.fill();
  }
  if (wins) {
    const end = side === "left" ? COLUMNS.barA[1] - length - 8 : COLUMNS.barB[0] + length + 8;
    text(ctx, `+${diff}`, end, cy + 5, 14, 700, color, side === "left" ? "right" : "left");
  }
}
