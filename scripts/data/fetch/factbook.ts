// CIA World Factbook, final edition (public domain), from the factbook.json GitHub mirror.
// The Factbook was discontinued in Feb 2026, so this only changes if the mirror is corrected.
//
// Profiles use CIA (GEC) codes, not ISO, so each of our countries is matched by, in order:
//   1. Wikidata's "World Factbook country ID" (P9948; run fetch/wikidata.ts first) as a GEC code or URL slug
//   2. the profile's internet country code (".ge") = our ISO alpha-2

import { loadCountries } from "../lib/countries.ts";
import { fetchJson, readCache, writeCache } from "../lib/io.ts";
import type { WikidataEntry } from "./wikidata.ts";

const REPO = "factbook/factbook.json";
const BRANCH = "master";
const PARALLEL_DOWNLOADS = 16;

export interface FactbookEntry {
  governmentType: string | null;
}

interface FactbookProfile {
  Government?: {
    "Country name"?: { "conventional short form"?: { text?: string }; "conventional long form"?: { text?: string } };
    "Government type"?: { text?: string };
  };
  Communications?: { "Internet country code"?: { text?: string } };
}

interface LoadedProfile {
  code: string; // GEC, e.g. "gg"
  slug: string; // e.g. "georgia", as in the old cia.gov URLs
  tld: string | null; // e.g. "ge"
  governmentType: string | null;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadProfile(code: string, path: string): Promise<LoadedProfile> {
  const p = await fetchJson<FactbookProfile>(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`, `Factbook ${path}`);
  const name = p.Government?.["Country name"];
  const shortName = name?.["conventional short form"]?.text;
  const displayName = shortName && shortName !== "none" ? shortName : (name?.["conventional long form"]?.text ?? code);
  const tld = p.Communications?.["Internet country code"]?.text?.match(/\.([a-z]{2})\b/)?.[1] ?? null;
  const type = p.Government?.["Government type"]?.text;
  return { code, slug: slugify(stripHtml(displayName)), tld, governmentType: type ? stripHtml(type) : null };
}

export async function fetchFactbook(): Promise<void> {
  const tree = await fetchJson<{ tree: { path: string }[] }>(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    "Factbook file list",
  );
  const files: [string, string][] = [];
  for (const { path } of tree.tree) {
    const match = /^[a-z-]+\/([a-z]{2})\.json$/.exec(path); // <region>/<code>.json
    if (match) {
      files.push([match[1], path]);
    }
  }

  const profiles: LoadedProfile[] = [];
  for (let i = 0; i < files.length; i += PARALLEL_DOWNLOADS) {
    const batch = files.slice(i, i + PARALLEL_DOWNLOADS);
    profiles.push(...(await Promise.all(batch.map(([code, path]) => loadProfile(code, path)))));
  }
  const byCode = new Map(profiles.map((p) => [p.code, p]));
  const bySlug = new Map(profiles.map((p) => [p.slug, p]));
  // .uk is the only internet domain that differs from its ISO code (GB).
  const isoFromTld = (tld: string) => (tld === "uk" ? "gb" : tld);
  const byTld = new Map(profiles.filter((p) => p.tld !== null).map((p) => [isoFromTld(p.tld!), p]));

  const wikidata = readCache<WikidataEntry>("wikidata").byCountry;
  const sampleIds = Object.values(wikidata).map((e) => e.factbookCode).filter((c) => c !== null).slice(0, 8);
  console.log(`  ${profiles.length} profiles; sample Wikidata Factbook IDs: ${sampleIds.join(", ")}`);

  const byCountry: Record<string, FactbookEntry> = {};
  const missing: string[] = [];
  for (const c of loadCountries()) {
    const wdCode = wikidata[c.id]?.factbookCode?.toLowerCase();
    const profile =
      (wdCode ? (byCode.get(wdCode) ?? bySlug.get(wdCode)) : undefined) ??
      (c.iso2 ? byTld.get(c.iso2.toLowerCase()) : undefined);
    if (profile === undefined) {
      missing.push(c.id);
      continue;
    }
    byCountry[c.id] = { governmentType: profile.governmentType };
  }
  console.log(`  no Factbook profile for: ${missing.join(" ") || "none"}`);
  writeCache("factbook", byCountry);
}
