export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatPixels(value: number): string {
  return `${value.toFixed(1)} px`;
}
