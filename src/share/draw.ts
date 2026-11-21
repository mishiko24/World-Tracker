// Canvas helpers shared by the share cards (shareCard.ts, comparisonCard.ts).

// Outfit (public/fonts, OFL) is loaded by loadCardAssets before any card is drawn; the rest is the fallback.
export const FONT = 'Outfit, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function font(size: number, weight: number): string {
  return `${weight} ${size}px ${FONT}`;
}

export function measure(ctx: CanvasRenderingContext2D, value: string, size: number, weight: number, letterSpacingEm = 0): number {
  ctx.font = font(size, weight);
  ctx.letterSpacing = `${letterSpacingEm * size}px`;
  const width = ctx.measureText(value).width;
  ctx.letterSpacing = "0px";
  return width;
}

// Largest font size (stepping down from `size`, not below 20) at which the text fits in maxWidth.
export function fitFont(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size: number, weight: number): number {
  while (size > 20 && measure(ctx, value, size, weight) > maxWidth) {
    size -= 2;
  }
  return size;
}

export function text(
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
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// share of `hex` mixed into `other` (both "#rrggbb"), like CSS color-mix(in srgb, hex share, other).
export function mix(hex: string, share: number, other: string): string {
  const a = rgb(hex);
  const b = rgb(other);
  const channel = (i: number) => Math.round(a[i] * share + b[i] * (1 - share));
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// A same-size scratch canvas, for drawing a layer before masking it.
export function layer(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d")!];
}

// Fades a layer out: keeps its pixels where the gradient is opaque. Applied twice = both fades.
export function fadeOut(ctx: CanvasRenderingContext2D, gradient: CanvasGradient): void {
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
