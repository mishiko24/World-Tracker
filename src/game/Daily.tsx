// Daily challenge screen (rules in daily.ts). Ten questions, then the result: score, 🟩🟥 grid, share, countdown to
// tomorrow's. Coming back the same day shows the result (or continues where the player left off).

import { useEffect, useState } from "react";
import type { CountrySummary } from "../data/countryData";
import { DAILY_ROUNDS, dailyRounds, dailyShareText, dayNumber, loadDailyResults, msUntilNextDaily, saveDailyResults, todayKey } from "./daily";
import { correctGuess, type Guess } from "./game";
import { CountryCard, playUrl, REVEAL_MS, shareScore } from "./shared";

export function Daily({ pool }: { pool: CountrySummary[] }) {
  const [dateKey] = useState(todayKey);
  const [rounds] = useState(() => dailyRounds(pool, dateKey));
  const [results, setResults] = useState(() => loadDailyResults(dateKey));
  const [guess, setGuess] = useState<Guess | null>(null);

  const index = results.length;
  const round = rounds[Math.min(index, DAILY_ROUNDS - 1)];
  const correct = guess !== null && guess === correctGuess(round);

  // After the reveal: record the answer and move on.
  useEffect(() => {
    if (guess === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      const next = [...results, correct];
      saveDailyResults(dateKey, next);
      setResults(next);
      setGuess(null);
    }, REVEAL_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [guess, correct, results, dateKey]);

  const progress = (
    <div className="daily-progress" aria-label={`Question ${Math.min(index + 1, DAILY_ROUNDS)} of ${DAILY_ROUNDS}`}>
      {rounds.map((_, i) => (
        <span key={i} className={i < results.length ? (results[i] ? "dot right" : "dot wrong") : i === index ? "dot current" : "dot"} />
      ))}
    </div>
  );

  if (index >= DAILY_ROUNDS) {
    return (
      <>
        <p className="question">Daily #{dayNumber(dateKey)}</p>
        {progress}
        <DailyResult dateKey={dateKey} results={results} />
      </>
    );
  }

  const { left, right, metric } = round;
  return (
    <>
      <p className="question">
        Daily #{dayNumber(dateKey)} · question {index + 1} of {DAILY_ROUNDS}
        <br />
        Does <strong>{right.name}</strong> have a higher or lower <strong>{metric.label}</strong> than <strong>{left.name}</strong>?
      </p>
      {progress}
      <div className="cards" data-metric={metric.key}>
        <CountryCard country={left} label={metric.label} value={metric.format(left[metric.key]!)} />
        <div className="versus">vs</div>
        <CountryCard country={right} label={metric.label} value={guess === null ? null : metric.format(right[metric.key]!)}>
          {guess === null ? (
            <div className="guess-buttons">
              <button className="guess higher" data-guess="higher" onClick={() => setGuess("higher")}>
                ▲ Higher
              </button>
              <button className="guess lower" data-guess="lower" onClick={() => setGuess("lower")}>
                ▼ Lower
              </button>
            </div>
          ) : (
            <div className={correct ? "verdict right-answer" : "verdict wrong-answer"}>{correct ? "✓ Correct" : "✗ Wrong"}</div>
          )}
        </CountryCard>
      </div>
    </>
  );
}

function DailyResult({ dateKey, results }: { dateKey: string; results: boolean[] }) {
  const [copied, setCopied] = useState(false);
  const [msLeft, setMsLeft] = useState(msUntilNextDaily);
  useEffect(() => {
    const timer = window.setInterval(() => setMsLeft(msUntilNextDaily()), 30_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const score = results.filter((r) => r).length;
  const hours = Math.floor(msLeft / 3_600_000);
  const minutes = Math.floor((msLeft % 3_600_000) / 60_000);

  return (
    <section className="game-over daily-result">
      <h2>
        {score}/{DAILY_ROUNDS}
      </h2>
      <p className="grid">{results.map((r) => (r ? "🟩" : "🟥")).join("")}</p>
      <div className="game-over-buttons">
        <button className="primary" onClick={() => shareScore(dailyShareText(dateKey, results), playUrl("daily")).then(setCopied)}>
          {copied ? "Copied" : "Share result"}
        </button>
        <a className="button" href="?mode=endless">
          Play endless
        </a>
      </div>
      <p className="next-daily">
        Next challenge in {hours}h {minutes}m
      </p>
    </section>
  );
}
