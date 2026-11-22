// Comparison share card ("fight poster"), 1200x630:
//
//   header      A's flag fades in from the left, B's from the right, split by a diagonal; both whole and darkened
//               (they are backgrounds). Names and the section's headline number (Power Level score, GDP, ...)
//               meet at the VS badge in the middle.
//   scoreboard  "categories won" tally (Power Level) or the section's name, then up to six rows
//               (comparisonSections.ts): A's bar | A's value | label | B's value | B's bar
//               Bars grow outward, on one 0-100 scale for scores, else the larger value fills its bar. The winner's
//               value is a teal pill, its bar solid with the gap ("+54", "4.1×") at its end; the loser's bar is
//               dimmer. Text rows (Government) put each side's text where its value and bar would be.
//
// Colors are the card's own (A pink-red, B sky blue, as everywhere: red = A, blue = B; teal = better), not the map
// colors, so every card looks the same whatever map style the sharer uses.

import { barWidths, winner } from "../ui/info/Compare";
import type { ComparisonSection, Headline, NumberRow, Row } from "./comparisonSections";
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

export function drawComparison(ctx: CanvasRenderingContext2D, a: CardSide, b: CardSide, flags: CardFlags, section: ComparisonSection, siteLabel: string): void {
  background(ctx);
  ctx.drawImage(header(flags), 0, 0);

  const h = section.headline;
  const win = winner({ a: h.a, b: h.b, format: h.format, better: h.better });
  headline(ctx, a, h.a, h, "left", win === "a");
  headline(ctx, b, h.b, h, "right", win === "b");
  vsBadge(ctx);

  if (section.tally) {
    tally(ctx, section.rows);
  } else {
    text(ctx, section.title.toUpperCase(), WIDTH / 2, 294, 15, 800, DIM, "center", 0.18);
  }
  // Rows centered in the space between the tally line and the footer.
  const top = 339 + ((6 - section.rows.length) * 37) / 2;
  section.rows.forEach((r, i) => row(ctx, r, top + i * 37));

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
// Name, color key line, the section's headline number and its caption. Left side is right-aligned against the VS
// badge, right side left-aligned.
function headline(ctx: CanvasRenderingContext2D, side: CardSide, value: number | null, h: Headline, align: "left" | "right", wins: boolean): void {
  const left = align === "left";
  const gap = 30;
  const x = left ? VS.x - VS.r - gap : VS.x + VS.r + gap;
  const textAlign = left ? "right" : "left";
  const room = left ? x - PADDING : WIDTH - PADDING - x;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 2;
  const nameSize = fitFont(ctx, side.country.name, room, 38, 800);
  text(ctx, side.country.name, x, 86, nameSize, 800, TEXT, textAlign);
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 4;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  if (value === null) {
    text(ctx, "No data", x, 176, 40, 700, DIM, textAlign);
  } else {
    const shown = h.format(value);
    const size = fitFont(ctx, shown, room, 90, 800);
    text(ctx, shown, x + (left ? 4 : -4), 190, size, 800, wins ? WIN : TEXT, textAlign, -0.02);
  }
  ctx.restore();

  ctx.fillStyle = left ? A : B;
  ctx.beginPath();
  ctx.roundRect(left ? x - 64 : x, 98, 64, 5, 2.5);
  ctx.fill();
  text(ctx, h.caption(side.data), x, 216, 14, 600, DIM, textAlign, 0.14);
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

// "1  CATEGORIES WON  5", counted over rows both countries have. Left out when they share none.
function tally(ctx: CanvasRenderingContext2D, rows: Row[]): void {
  const numbers = rows.filter((r): r is NumberRow => r.kind === "number" && r.a !== null && r.b !== null);
  if (numbers.length === 0) {
    return;
  }
  const wins = numbers.map((r) => winner({ a: r.a, b: r.b, format: r.format, better: r.better }));
  const wonA = String(wins.filter((w) => w === "a").length);
  const wonB = String(wins.filter((w) => w === "b").length);
  const label = "CATEGORIES WON";
  const gap = 14;
  const labelW = measure(ctx, label, 13, 700, 0.16);
  const y = 298;
  text(ctx, wonA, WIDTH / 2 - labelW / 2 - gap, y, 30, 900, A, "right");
  text(ctx, label, WIDTH / 2, y - 4, 13, 700, DIM, "center", 0.16);
  text(ctx, wonB, WIDTH / 2 + labelW / 2 + gap, y, 30, 900, B, "left");
}

// Columns (centered): bar | pill | label | pill | bar.
const COL = { bar: 250, pill: 140, label: 180, gap: 10 };
const ROW_W = 2 * COL.bar + 2 * COL.pill + COL.label + 4 * COL.gap;
const X0 = (WIDTH - ROW_W) / 2;
const COLUMNS = {
  barA: [X0, X0 + COL.bar],
  pillA: X0 + COL.bar + COL.gap + COL.pill / 2, // centers
  label: WIDTH / 2,
  pillB: WIDTH / 2 + COL.label / 2 + COL.gap + COL.pill / 2,
  barB: [WIDTH - X0 - COL.bar, WIDTH - X0],
};

function row(ctx: CanvasRenderingContext2D, r: Row, y: number): void {
  const labelSize = fitFont(ctx, r.label, COL.label, 16, 600);
  text(ctx, r.label, COLUMNS.label, y + 6, Math.min(labelSize, 16), 600, "rgba(255, 255, 255, 0.7)", "center", 0.02);
  if (r.kind === "text") {
    textSide(ctx, r.a, "left", y);
    textSide(ctx, r.b, "right", y);
    return;
  }
  const compare = { a: r.a, b: r.b, format: r.format, better: r.better, mode: r.mode };
  const win = winner(compare);
  const [widthA, widthB] = r.fixedScale ? [r.a ?? 0, r.b ?? 0] : barWidths(compare);
  const gapText = shortGap(r, win);
  pill(ctx, r.a === null ? "—" : r.format(r.a), COLUMNS.pillA, y, win === "a");
  pill(ctx, r.b === null ? "—" : r.format(r.b), COLUMNS.pillB, y, win === "b");
  if (r.a !== null) {
    bar(ctx, widthA, win === "a", win === "b", A, "left", y, gapText);
  }
  if (r.b !== null) {
    bar(ctx, widthB, win === "b", win === "a", B, "right", y, gapText);
  }
}

// Text rows (Government): each side's text from the label outward, over its pill and bar columns.
function textSide(ctx: CanvasRenderingContext2D, value: string | null, side: "left" | "right", cy: number): void {
  const room = COL.bar + COL.gap + COL.pill;
  const shown = value ?? "—";
  const size = measure(ctx, shown, 20, 700) <= room ? 20 : 16; // long names one step smaller, then cut
  const fitted = cut(ctx, shown, room, size, 700);
  const x = side === "left" ? COLUMNS.label - COL.label / 2 - COL.gap : COLUMNS.label + COL.label / 2 + COL.gap;
  text(ctx, fitted, x, cy + 7, size, 700, value === null ? DIM : TEXT, side === "left" ? "right" : "left");
}

// The text, cut with "…" to fit maxWidth.
function cut(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size: number, weight: number): string {
  if (measure(ctx, value, size, weight) <= maxWidth) {
    return value;
  }
  let shown = value;
  while (shown.length > 1 && measure(ctx, `${shown}…`, size, weight) > maxWidth) {
    shown = shown.slice(0, -1);
  }
  return `${shown.trimEnd()}…`;
}

function pill(ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number, wins: boolean): void {
  const size = Math.min(fitFont(ctx, label, COL.pill - 22, 25, 800), 25);
  if (wins) {
    const w = Math.min(Math.max(64, measure(ctx, label, size, 800) + 22), COL.pill);
    ctx.fillStyle = WIN;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - 17, w, 34, 17);
    ctx.fill();
  }
  text(ctx, label, cx, cy + 9, size, 800, wins ? WIN_TEXT : SOFT, "center");
}

// A's bar grows left from its pill, B's grows right. Winner: solid, the gap at its end; loser: dimmer.
// widthPct: % of the bar column.
function bar(ctx: CanvasRenderingContext2D, widthPct: number, wins: boolean, loses: boolean, color: string, side: "left" | "right", cy: number, gapText: string | null): void {
  const length = (COL.bar * Math.min(Math.max(widthPct, 0), 100)) / 100;
  if (length > 0) {
    const h = 14;
    const x = side === "left" ? COLUMNS.barA[1] - length : COLUMNS.barB[0];
    ctx.fillStyle = loses ? mix(color, 0.52, LOSER_MIX) : color;
    ctx.beginPath();
    const outer = Math.min(7, length / 2); // short bars: corners can't be rounder than the bar is long
    const inner = Math.min(3, length / 2);
    ctx.roundRect(x, cy - h / 2, length, h, side === "left" ? [outer, inner, inner, outer] : [inner, outer, outer, inner]);
    ctx.fill();
  }
  if (wins && gapText !== null) {
    const end = side === "left" ? COLUMNS.barA[1] - length - 8 : COLUMNS.barB[0] + length + 8;
    text(ctx, gapText, end, cy + 5, 14, 700, color, side === "left" ? "right" : "left");
  }
}

// The gap at the end of the winner's bar, short: "+54", "4.1×", "+58%", "+2.8 pp", "+1.3 yrs".
function shortGap(r: NumberRow, win: "a" | "b" | null): string | null {
  if (win === null || r.a === null || r.b === null) {
    return null;
  }
  const [w, l] = win === "a" ? [r.a, r.b] : [r.b, r.a];
  const diff = Math.abs(w - l);
  switch (r.mode) {
    case "score":
      return `+${diff.toFixed(0)}`;
    case "points":
      return `${diff.toFixed(1)} pp`;
    case "years":
      return `${diff.toFixed(1)} yrs`;
    default: {
      if (r.better === "lower") {
        return l > 0 && w > 0 ? `${(l / w).toFixed(l / w < 10 ? 1 : 0)}× less` : null;
      }
      if (l <= 0) {
        return null;
      }
      const ratio = w / l;
      return ratio >= 2 ? `${ratio.toFixed(ratio < 10 ? 1 : 0)}×` : `+${((ratio - 1) * 100).toFixed(0)}%`;
    }
  }
}
