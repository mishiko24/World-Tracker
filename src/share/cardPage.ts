// Headless page (share-card.html) that scripts/site/cards.ts drives at build time to draw the link-preview image
// of every static page, with the same code as the Share button. Not linked from the site.
// Exposes window.renderShareCard(a, b, siteLabel) and window.renderHomeCard(siteLabel) -> JPEG data URL,
// and sets window.shareCardReady when loaded.
// JPEG, not PNG: the gradients and flag blur make PNGs ~300 KB; link previews don't need lossless.

import type { CountryData, CountrySummary } from "../data/countryData";
import { loadCountries } from "../map/geo";
import { drawHomeCard, drawShareCard, loadCardAssets, loadCardFonts, type CardSide } from "./shareCard";

declare global {
  interface Window {
    renderShareCard: (a: string, b: string | null, siteLabel: string) => Promise<string>;
    renderHomeCard: (siteLabel: string) => Promise<string>;
    shareCardReady: boolean;
  }
}

const JPEG_QUALITY = 0.86;

const countryList = await loadCountries();
const countries = new Map(countryList.map((c) => [c.id, c]));

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function side(id: string): Promise<CardSide> {
  return { country: countries.get(id)!, data: await fetchJson<CountryData>(`data/countries/${id}.json`) };
}

window.renderShareCard = async (a, b, siteLabel) => {
  const canvas = document.createElement("canvas");
  const sideA = await side(a);
  const sideB = b === null ? null : await side(b);
  drawShareCard(canvas, sideA, sideB, await loadCardAssets(sideA, sideB), siteLabel);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
};
// Power Level of every scored country, normalized to 0..1 like the map's heat-map mode (App.tsx).
window.renderHomeCard = async (siteLabel) => {
  const scored = (await fetchJson<CountrySummary[]>("data/summary.json")).filter((s) => s.powerLevel !== null);
  const min = Math.min(...scored.map((s) => s.powerLevel!));
  const max = Math.max(...scored.map((s) => s.powerLevel!));
  const levels = new Map(scored.map((s) => [s.id, (s.powerLevel! - min) / (max - min)]));
  const canvas = document.createElement("canvas");
  await loadCardFonts();
  drawHomeCard(canvas, countryList, levels, siteLabel);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
};
window.shareCardReady = true;
