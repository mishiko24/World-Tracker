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
  militarySpending: [year: number, percentOfGdp: number][]; // oldest first; empty = none
  personnel: Personnel | null;
}

// Active military personnel. The Factbook gives prose ("estimated 1.1-1.2 million active Armed Forces; ..."):
// the first number (or range) is the active armed forces.
export interface Personnel {
  low: number;
  high: number; // = low when the Factbook gives one number
  year: number;
  text: string; // the Factbook's sentence, shown with the number
}

interface FactbookProfile {
  Government?: {
    "Country name"?: { "conventional short form"?: { text?: string }; "conventional long form"?: { text?: string } };
    "Government type"?: { text?: string };
  };
  Communications?: { "Internet country code"?: { text?: string } };
  "Military and Security"?: {
    "Military expenditures"?: Record<string, { text?: string } | string>; // "Military Expenditures 2024": "1.5% of GDP (2024 est.)"
    "Military and security service personnel strengths"?: { text?: string };
  };
}

interface LoadedProfile extends FactbookEntry {
  code: string; // GEC, e.g. "gg"
  slug: string; // e.g. "georgia", as in the old cia.gov URLs
  tld: string | null; // e.g. "ge"
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", ndash: "–", mdash: "—" };

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/g, (match, name: string) => ENTITIES[name] ?? match)
    .replace(/\s+/g, " ")
    .trim();
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
  const military = p["Military and Security"];
  return {
    code,
    slug: slugify(stripHtml(displayName)),
    tld,
    governmentType: type ? stripHtml(type) : null,
    militarySpending: spendingHistory(military?.["Military expenditures"] ?? {}),
    personnel: parsePersonnel(military?.["Military and security service personnel strengths"]?.text),
  };
}

// "Military Expenditures 2024": {text: "1.5% of GDP (2024 est.)"} -> [2024, 1.5]. Other formats are not used
// (a handful of profiles say "not available" or give prose).
function spendingHistory(entries: Record<string, { text?: string } | string>): [number, number][] {
  const history: [number, number][] = [];
  for (const [key, entry] of Object.entries(entries)) {
    const year = /^Military Expenditures (\d{4})$/.exec(key)?.[1];
    const percent = typeof entry === "object" ? /^([\d.]+)% of GDP/.exec(entry.text ?? "")?.[1] : undefined;
    if (year !== undefined && percent !== undefined) {
      history.push([Number(year), Number(percent)]);
    }
  }
  return history.sort((a, b) => a[0] - b[0]);
}

// First number or range in the sentence. "10-15,000" means 10,000-15,000; "1.1-1.2 million" both in millions.
// Sentences about the past ("prior to the outbreak of fighting ...") have no current number.
const NUMBER = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const AMOUNT = new RegExp(`${NUMBER}(?:\\s*-\\s*${NUMBER})?(\\s+million)?`);

export function parsePersonnel(raw: string | undefined): Personnel | null {
  if (raw === undefined) {
    return null;
  }
  const text = stripHtml(raw);
  const year = /\((\d{4})\)\s*$/.exec(text)?.[1];
  const match = AMOUNT.exec(text);
  if (year === undefined || match === null || /^prior to/i.test(text)) {
    return null;
  }
  const [, first, second, million] = match;
  const number = (s: string) => Number(s.replace(/,/g, ""));
  const scale = million ? 1e6 : 1;
  const high = number(second ?? first) * scale;
  let low = number(first);
  if (second === undefined || million) {
    low *= first.includes(",") ? 1 : scale; // "950,000-1 million" is already whole; "1.1-1.2 million" isn't
  } else if (!first.includes(",") && second.includes(",")) {
    low *= 1000; // "10-15,000": the first number borrows the second's thousands
  }
  return { low, high, year: Number(year), text: text.replace(/\s*\(\d{4}\)\s*$/, "") };
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
    byCountry[c.id] = {
      governmentType: profile.governmentType,
      militarySpending: profile.militarySpending,
      personnel: profile.personnel,
    };
  }
  console.log(`  no Factbook profile for: ${missing.join(" ") || "none"}`);
  writeCache("factbook", byCountry);
}
