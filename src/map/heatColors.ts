// Color scale for heat-map modes (e.g. Power Level): three color stops per map type, interpolated in RGB.
// t = 0 is the lowest value on the map, t = 1 the highest.

import type { MapType } from "./mapTypes";

const STOPS: Record<MapType, [string, string, string]> = {
  dark: ["#2c3170", "#b0458f", "#ffd25a"],
  light: ["#ece9fb", "#a78bfa", "#3b1e8a"],
  satellite: ["#2c3170", "#b0458f", "#ffd25a"],
};

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const channel = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * t).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

export function heatColor(mapType: MapType, t: number): string {
  const [low, mid, high] = STOPS[mapType];
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped < 0.5 ? mix(low, mid, clamped * 2) : mix(mid, high, (clamped - 0.5) * 2);
}

export function heatGradientCss(mapType: MapType): string {
  const [low, mid, high] = STOPS[mapType];
  return `linear-gradient(to right, ${low}, ${mid}, ${high})`;
}
