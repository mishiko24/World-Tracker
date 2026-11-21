// Daily challenge: DAILY_ROUNDS Higher-or-Lower questions, the same for everyone on the same UTC day (seeded by the
// date), chained like the endless game (each round's right country becomes the next round's left). The player
// answers all of them; a wrong answer doesn't end the game. One attempt per day, kept in localStorage.

import type { CountrySummary } from "../data/countryData";
import { nextRound, type Round } from "./game";
import { hashSeed, seededRandom } from "./random";

export const DAILY_ROUNDS = 10;
const FIRST_DAY = "2026-11-21"; // Daily #1 (UTC date of launch)
const STORAGE_PREFIX = "worldTracker.daily.";

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // UTC date: one puzzle worldwide, new one at 00:00 UTC
}

export function dayNumber(dateKey: string): number {
  return Math.round((Date.parse(dateKey) - Date.parse(FIRST_DAY)) / 86_400_000) + 1;
}

export function dailyRounds(pool: CountrySummary[], dateKey: string): Round[] {
  const random = seededRandom(hashSeed(`world-tracker-daily-${dateKey}`));
  const rounds: Round[] = [nextRound(pool, null, random)];
  while (rounds.length < DAILY_ROUNDS) {
    rounds.push(nextRound(pool, rounds[rounds.length - 1].right, random));
  }
  return rounds;
}

// Answers so far (true = correct); [] when not played yet today.
export function loadDailyResults(dateKey: string): boolean[] {
  return JSON.parse(localStorage.getItem(STORAGE_PREFIX + dateKey) ?? "[]") as boolean[];
}

export function saveDailyResults(dateKey: string, results: boolean[]): void {
  localStorage.setItem(STORAGE_PREFIX + dateKey, JSON.stringify(results));
}

// "World Tracker Daily #3: 7/10" + 🟩🟥 grid, for sharing.
export function dailyShareText(dateKey: string, results: boolean[]): string {
  const score = results.filter((r) => r).length;
  return `World Tracker Daily #${dayNumber(dateKey)}: ${score}/${DAILY_ROUNDS}\n${results.map((r) => (r ? "🟩" : "🟥")).join("")}`;
}

// Milliseconds until the next puzzle (00:00 UTC).
export function msUntilNextDaily(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
}
