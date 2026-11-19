// CIA World Factbook, final edition (public domain), from the factbook.json GitHub mirror.
// The Factbook was discontinued in Feb 2026, so this only changes if the mirror is corrected.
// Joined via Wikidata's "World Factbook country ID" (P9948), so run fetch/wikidata.ts first.

import { fetchJson, readCache, writeCache } from "../lib/io.ts";
import type { WikidataEntry } from "./wikidata.ts";

const REPO = "factbook/factbook.json";
const BRANCH = "master";

export interface FactbookEntry {
  governmentType: string | null;
}

interface FactbookProfile {
  Government?: { "Government type"?: { text?: string } };
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchFactbook(): Promise<void> {
  const tree = await fetchJson<{ tree: { path: string }[] }>(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    "Factbook file list",
  );
  // Profiles live at <region>/<code>.json, e.g. central-asia/gg.json
  const pathByCode = new Map<string, string>();
  for (const { path } of tree.tree) {
    const match = /^[a-z-]+\/([a-z]{2})\.json$/.exec(path);
    if (match) {
      pathByCode.set(match[1], path);
    }
  }

  const wikidata = readCache<WikidataEntry>("wikidata").byCountry;
  const byCountry: Record<string, FactbookEntry> = {};
  const missing: string[] = [];
  for (const [id, entry] of Object.entries(wikidata)) {
    const path = entry.factbookCode ? pathByCode.get(entry.factbookCode.toLowerCase()) : undefined;
    if (path === undefined) {
      missing.push(id);
      continue;
    }
    const profile = await fetchJson<FactbookProfile>(
      `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`,
      `Factbook ${path}`,
    );
    const type = profile.Government?.["Government type"]?.text;
    byCountry[id] = { governmentType: type ? stripHtml(type) : null };
  }
  console.log(`  no Factbook profile for: ${missing.join(" ")}`);
  writeCache("factbook", byCountry);
}
