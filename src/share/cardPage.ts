// Headless page (share-card.html) that scripts/site/cards.ts drives at build time to draw the link-preview image
// of every static page, with the same code as the Share button. Not linked from the site.
// Exposes window.renderShareCard(a, b, siteLabel), window.renderMapCard(columnId, siteLabel) and
// window.renderHomeCard(siteLabel) -> JPEG data URL, and sets window.shareCardReady when loaded.
// JPEG, not PNG: the gradients and flag blur make PNGs ~300 KB; link previews don't need lossless.

import type { CountryData, CountrySummary, DataMeta } from "../data/countryData";
import { colorScale, findColumn, type ColorScale } from "../map/colorBy";
import { loadCountries } from "../map/geo";
import { columnGroups } from "../ui/list/columns";
import { TRADE_GROUPS, tradeColor, type TradeGroupId } from "../data/trade";
import { drawCategoryMapCard, drawMapCard, loadTopFlags } from "./mapCard";
import { drawHomeCard, drawShareCard, loadCardAssets, loadCardFonts, type CardSide } from "./shareCard";

declare global {
  interface Window {
    renderShareCard: (a: string, b: string | null, siteLabel: string) => Promise<string>;
    renderHomeCard: (siteLabel: string) => Promise<string>;
    renderMapCard: (columnId: string, siteLabel: string, pixelRatio?: number) => Promise<string>;
    renderExportMixCard: (siteLabel: string, pixelRatio?: number) => Promise<string>;
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
// The world colored by one list column, exactly as the map's "Color countries by" (map/colorBy.ts).
const summaries = await fetchJson<CountrySummary[]>("data/summary.json");
const groups = columnGroups((await fetchJson<DataMeta>("data/meta.json")).resources);
function scaleOf(columnId: string): ColorScale {
  const found = findColumn(groups, columnId)!;
  return colorScale(found.column, found.group, summaries);
}

window.renderMapCard = async (columnId, siteLabel, pixelRatio = 1) => {
  const scale = scaleOf(columnId);
  const canvas = document.createElement("canvas");
  await loadCardFonts();
  drawMapCard(canvas, countryList, scale, await loadTopFlags(scale), siteLabel, pixelRatio);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
};

// Each country colored by the category that makes up most of its goods exports.
window.renderExportMixCard = async (siteLabel, pixelRatio = 1) => {
  const fills = new Map<string, string>();
  const counts = new Map<TradeGroupId, number>();
  for (const row of summaries) {
    const biggest = (Object.entries(row.exportGroups) as [TradeGroupId, number][]).sort((x, y) => y[1] - x[1])[0];
    if (biggest !== undefined) {
      fills.set(row.id, tradeColor(biggest[0]));
      counts.set(biggest[0], (counts.get(biggest[0]) ?? 0) + 1);
    }
  }
  const legend = TRADE_GROUPS.map((g) => ({ label: g.label, color: tradeColor(g.id), count: counts.get(g.id) ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((x, y) => y.count - x.count);
  const canvas = document.createElement("canvas");
  await loadCardFonts();
  drawCategoryMapCard(canvas, countryList, { title: "Each country's biggest export", fills, legend, source: "CEPII BACI goods trade" }, siteLabel, pixelRatio);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
};

window.renderHomeCard = async (siteLabel) => {
  const canvas = document.createElement("canvas");
  await loadCardFonts();
  drawHomeCard(canvas, countryList, scaleOf("powerLevel").positions, siteLabel);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
};
window.shareCardReady = true;
