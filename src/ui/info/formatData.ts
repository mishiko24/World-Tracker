// Number formatting for the info panel. Big numbers are shortened (1.2 M, 3.4 bn, 5.6 tn).

import type { Amount } from "../../data/countryData";

function trimmed(value: number, decimals: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

// 950 -> "950", 12_300 -> "12.3 k", 4.56e6 -> "4.56 M", 7.8e9 -> "7.8 bn", 1.2e12 -> "1.2 tn"
export function shortNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) {
    return `${trimmed(value / 1e12, 2)} tn`;
  }
  if (abs >= 1e9) {
    return `${trimmed(value / 1e9, 2)} bn`;
  }
  if (abs >= 1e6) {
    return `${trimmed(value / 1e6, 2)} M`;
  }
  if (abs >= 1e4) {
    return `${trimmed(value / 1e3, 1)} k`;
  }
  return trimmed(value, abs < 10 ? 2 : 0);
}

export function fullNumber(value: number): string {
  return trimmed(value, 0);
}

export function dollars(value: number): string {
  return `$${shortNumber(value)}`;
}

export function percent(value: number, decimals = 1): string {
  return `${trimmed(value, decimals)}%`;
}

export function share(fraction: number): string {
  if (fraction < 0.001) {
    return "<0.1%";
  }
  return percent(fraction * 100, fraction < 0.1 ? 1 : 0);
}

// Tonnes with metric prefixes: 850 t, 158 kt, 1.2 Mt, 3.4 Gt.
export function tonnes(t: number): string {
  if (t >= 1e9) {
    return `${trimmed(t / 1e9, 2)} Gt`;
  }
  if (t >= 1e6) {
    return `${trimmed(t / 1e6, 2)} Mt`;
  }
  if (t >= 1e3) {
    return `${trimmed(t / 1e3, 1)} kt`;
  }
  return `${trimmed(t, t < 10 ? 2 : 0)} t`;
}

export function amount(a: Amount): string {
  switch (a.unit) {
    case "bbl/day":
      return `${shortNumber(a.value)} barrels/day`;
    case "bbl":
      return `${shortNumber(a.value)} barrels`;
    case "m³/year":
      return `${shortNumber(a.value)} m³/year`;
    case "m³":
      return `${shortNumber(a.value)} m³`;
    case "t/year":
      return `${tonnes(a.value)}/year`;
    case "t":
      return tonnes(a.value);
    case "kg/year":
      return a.value >= 1000 ? `${tonnes(a.value / 1000)}/year` : `${trimmed(a.value, 0)} kg/year`;
    case "kg":
      return a.value >= 1000 ? tonnes(a.value / 1000) : `${trimmed(a.value, 0)} kg`;
    case "carats/year":
      return `${shortNumber(a.value)} carats/year`;
    case "carats":
      return `${shortNumber(a.value)} carats`;
  }
}
