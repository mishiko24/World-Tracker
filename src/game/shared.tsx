// Pieces shared by the game modes: data loading, the country card, sharing a score.

import { useEffect, useState, type ReactNode } from "react";
import type { CountrySummary } from "../data/countryData";
import type { Nearby } from "../data/sitePages";
import { flagUrl } from "../ui/Flag";

export const REVEAL_MS = 1300; // how long an answer's result stays before the next question

// Only recognizable countries: a Power Level and at least this many people.
const POOL_MIN_POPULATION = 1_000_000;

export interface GameData {
  pool: CountrySummary[];
  nearby: Nearby;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function useGameData(): GameData | null {
  const [data, setData] = useState<GameData | null>(null);
  useEffect(() => {
    Promise.all([fetchJson<CountrySummary[]>("data/summary.json"), fetchJson<Nearby>("data/nearby.json")]).then(([summaries, nearby]) => {
      setData({
        pool: summaries.filter((s) => s.powerLevel !== null && s.population !== null && s.population >= POOL_MIN_POPULATION),
        nearby,
      });
    });
  }, []);
  return data;
}

// Best score per game mode, kept in this browser.
export function loadBest(key: string): number {
  return Number(localStorage.getItem(`worldTracker.best.${key}`) ?? 0);
}

export function saveBest(key: string, value: number): void {
  localStorage.setItem(`worldTracker.best.${key}`, String(value));
}

// Native share sheet where there is one (phones), else copy to the clipboard. Resolves to true when copied.
export async function shareScore(text: string, url: string): Promise<boolean> {
  const nav: Partial<Navigator> = navigator; // TypeScript assumes share() exists; desktop Firefox lacks it
  if (nav.share !== undefined) {
    await navigator.share({ text, url }).catch((e: DOMException) => {
      if (e.name !== "AbortError") {
        throw e; // AbortError = the user closed the share sheet
      }
    });
    return false;
  }
  await navigator.clipboard.writeText(`${text}\n${url}`);
  return true;
}

export function playUrl(mode: string): string {
  return new URL(`play.html?mode=${mode}`, window.location.href).href;
}

interface CountryCardProps {
  country: CountrySummary;
  label: string;
  value: string | null; // null = hidden (to be guessed)
  children?: ReactNode;
}

export function CountryCard({ country, label, value, children }: CountryCardProps) {
  return (
    <section className="country-card" data-id={country.id}>
      <img className="card-flag" src={flagUrl(country.id)} alt="" />
      <h2>{country.name}</h2>
      <div className="card-label">{label}</div>
      <div className="card-value">{value ?? "?"}</div>
      {children}
    </section>
  );
}
