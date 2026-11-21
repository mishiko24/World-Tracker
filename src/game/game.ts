// Higher or Lower: the game's rules, without UI (GamePage.tsx draws it).
//
// Each round shows two countries and one stat. The left country's value is visible; the player guesses whether the
// right country's value is higher or lower. Correct: the right country moves left and a new one comes in, with a new
// random stat. Wrong: game over. The streak is the number of correct answers in a row.
//
// Fairness: only recognizable countries (POOL_MIN_POPULATION people and a Power Level), and never a near-tie
// (values at least MIN_DIFFERENCE apart), so every answer can be reasoned about.

import type { CountrySummary } from "../data/countryData";
import { dollars, fullNumber, shortNumber } from "../ui/info/formatData";

const POOL_MIN_POPULATION = 1_000_000;
const MIN_DIFFERENCE = 0.05; // 5% of the larger value

type MetricKey = "population" | "gdp" | "gdpPerCapita" | "lifeExpectancy" | "powerLevel" | "electricityTwh" | "medianAge" | "density";

export interface Metric {
  key: MetricKey;
  label: string; // "Does Canada have a higher or lower <label> than the United States?"
  format: (value: number) => string;
}

export const METRICS: Metric[] = [
  { key: "population", label: "population", format: (v) => shortNumber(v) },
  { key: "gdp", label: "GDP", format: dollars },
  { key: "gdpPerCapita", label: "GDP per person", format: dollars },
  { key: "lifeExpectancy", label: "life expectancy", format: (v) => `${v.toFixed(1)} years` },
  { key: "powerLevel", label: "Power Level", format: (v) => v.toFixed(1) },
  { key: "electricityTwh", label: "electricity generation", format: (v) => `${fullNumber(v)} TWh` },
  { key: "medianAge", label: "median age", format: (v) => `${v.toFixed(1)} years` },
  { key: "density", label: "population density", format: (v) => `${fullNumber(v)} per km²` },
];

export interface Round {
  left: CountrySummary;
  right: CountrySummary;
  metric: Metric;
}

export type Guess = "higher" | "lower";

export function gamePool(summaries: CountrySummary[]): CountrySummary[] {
  return summaries.filter((s) => s.powerLevel !== null && s.population !== null && s.population >= POOL_MIN_POPULATION);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Next round with `left` on the left (first round: a random left country). Picks a stat the left country has,
// then a right country with a clearly different value for it.
export function nextRound(pool: CountrySummary[], left: CountrySummary = pick(pool)): Round {
  for (const metric of [...METRICS].sort(() => Math.random() - 0.5)) {
    const a = left[metric.key];
    if (a === null) {
      continue;
    }
    const candidates = pool.filter((c) => {
      const b = c[metric.key];
      return c.id !== left.id && b !== null && Math.abs(a - b) >= MIN_DIFFERENCE * Math.max(Math.abs(a), Math.abs(b));
    });
    if (candidates.length > 0) {
      return { left, right: pick(candidates), metric };
    }
  }
  throw new Error(`No playable round for ${left.id}`);
}

export function correctGuess(round: Round): Guess {
  return round.right[round.metric.key]! > round.left[round.metric.key]! ? "higher" : "lower";
}
