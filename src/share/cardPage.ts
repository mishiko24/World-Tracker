// Headless page (share-card.html) that scripts/site/cards.ts drives at build time to draw the link-preview image
// of every static page, with the same code as the Share button. Not linked from the site.
// Exposes window.renderShareCard(a, b, siteLabel) -> JPEG data URL, and sets window.shareCardReady when loaded.
// JPEG, not PNG: the color glows make PNGs ~300 KB; link previews don't need lossless.

import type { CountryData } from "../data/countryData";
import { loadCountries } from "../map/geo";
import { DEFAULT_SETTINGS } from "../settings";
import { drawShareCard, loadCardFlags, type CardSide } from "./shareCard";

declare global {
  interface Window {
    renderShareCard: (a: string, b: string | null, siteLabel: string) => Promise<string>;
    shareCardReady: boolean;
  }
}

// Same colors as a fresh visitor sees on the default (dark) map.
const COLORS = { a: DEFAULT_SETTINGS.styles.dark.selected.fillColor, b: DEFAULT_SETTINGS.styles.dark.compared.fillColor };

const JPEG_QUALITY = 0.86;

const countries = new Map((await loadCountries()).map((c) => [c.id, c]));

async function side(id: string, color: string): Promise<CardSide> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/countries/${id}.json`);
  if (!response.ok) {
    throw new Error(`${id}.json: HTTP ${response.status}`);
  }
  return { country: countries.get(id)!, data: (await response.json()) as CountryData, color };
}

window.renderShareCard = async (a, b, siteLabel) => {
  const canvas = document.createElement("canvas");
  const sideA = await side(a, COLORS.a);
  const sideB = b === null ? null : await side(b, COLORS.b);
  drawShareCard(canvas, sideA, sideB, await loadCardFlags(sideA, sideB), siteLabel);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
};
window.shareCardReady = true;
