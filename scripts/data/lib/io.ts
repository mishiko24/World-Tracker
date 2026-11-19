// HTTP and cache helpers shared by all fetchers.
//
// Cache files (data-cache/<source>.json) hold each source's data already matched to our country ids,
// so build.ts never touches the network and can be re-run any time. They are committed to git:
// diffs show exactly what a monthly refresh changed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const USER_AGENT = "WorldTracker/1.0 (https://github.com/mishiko24/World-Tracker)";
const CACHE_DIR = "data-cache";

// `label` is what appears in errors instead of the URL, so API keys in query strings never get logged.
export async function fetchText(url: string, label: string, headers: Record<string, string> = {}): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers } });
  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function fetchJson<T>(url: string, label: string, headers: Record<string, string> = {}): Promise<T> {
  return JSON.parse(await fetchText(url, label, headers)) as T;
}

export async function fetchBytes(url: string, label: string): Promise<Uint8Array> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export interface Cache<T> {
  fetchedAt: string;
  byCountry: Record<string, T>;
}

export function writeCache<T>(source: string, byCountry: Record<string, T>): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cache: Cache<T> = { fetchedAt: new Date().toISOString(), byCountry };
  writeFileSync(`${CACHE_DIR}/${source}.json`, JSON.stringify(cache, null, 1));
  console.log(`  wrote ${CACHE_DIR}/${source}.json (${Object.keys(byCountry).length} countries)`);
}

export function readCache<T>(source: string): Cache<T> {
  return JSON.parse(readFileSync(`${CACHE_DIR}/${source}.json`, "utf8")) as Cache<T>;
}

export function lastFullYear(): number {
  return new Date().getUTCFullYear() - 1;
}
