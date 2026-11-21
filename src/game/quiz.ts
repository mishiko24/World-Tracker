// Flag and outline quizzes: show a country's flag (or its outline), pick its name from QUIZ_OPTIONS choices.
// Wrong options come partly from the answer's neighbours (nearby.json) so the choice isn't obvious
// (Chad vs Romania, Ireland vs Côte d'Ivoire), the rest at random. LIVES wrong answers end the game.

import type { CountrySummary } from "../data/countryData";
import type { Nearby } from "../data/sitePages";
import { pick, shuffled, type Random } from "./random";

export const QUIZ_OPTIONS = 4;
export const LIVES = 3;
const NEIGHBOUR_OPTIONS = 2;

export type QuizKind = "flags" | "outlines";

export interface Question {
  answer: CountrySummary;
  options: CountrySummary[]; // QUIZ_OPTIONS countries, answer among them, shuffled
}

// `asked`: ids already used this game, so a country doesn't come back until the pool runs out.
export function nextQuestion(pool: CountrySummary[], nearby: Nearby, asked: Set<string>, random: Random = Math.random): Question {
  const fresh = pool.filter((c) => !asked.has(c.id));
  const answer = pick(fresh.length > 0 ? fresh : pool, random);
  const byId = new Map(pool.map((c) => [c.id, c]));
  const neighbours = shuffled(nearby[answer.id] ?? [], random)
    .map((id) => byId.get(id))
    .filter((c): c is CountrySummary => c !== undefined)
    .slice(0, NEIGHBOUR_OPTIONS);
  const options = [answer, ...neighbours];
  for (const c of shuffled(pool, random)) {
    if (options.length === QUIZ_OPTIONS) {
      break;
    }
    if (!options.includes(c)) {
      options.push(c);
    }
  }
  return { answer, options: shuffled(options, random) };
}
