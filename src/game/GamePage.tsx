// Higher or Lower page (play.html). Rules in game.ts; this file only draws them.
//
//   guessing  left value visible, right value hidden, Higher / Lower buttons
//   revealed  right value shown with ✓ or ✗ for REVEAL_MS, then the next round or game over
//   over      streak, best, play again, share score, open the last pair on the map
// Best streak is kept in localStorage (per browser).

import { useEffect, useState, type ReactNode } from "react";
import type { CountrySummary } from "../data/countryData";
import { flagUrl } from "../ui/Flag";
import { correctGuess, gamePool, nextRound, type Guess, type Round } from "./game";

const REVEAL_MS = 1300;
const BEST_KEY = "worldTracker.higherLower.best";

type Phase = "guessing" | "revealed" | "over";

function useSummaries(): CountrySummary[] | null {
  const [summaries, setSummaries] = useState<CountrySummary[] | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/summary.json`)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`summary.json: HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(setSummaries);
  }, []);
  return summaries;
}

export function GamePage() {
  const summaries = useSummaries();
  if (summaries === null) {
    return <p className="loading">Loading countries…</p>;
  }
  return <Game pool={gamePool(summaries)} />;
}

function Game({ pool }: { pool: CountrySummary[] }) {
  const [round, setRound] = useState<Round>(() => nextRound(pool));
  const [phase, setPhase] = useState<Phase>("guessing");
  const [guess, setGuess] = useState<Guess | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) ?? 0));
  const [bestBeforeRun, setBestBeforeRun] = useState(best); // "new best!" only when this run beat it

  const correct = guess !== null && guess === correctGuess(round);

  function answer(g: Guess) {
    setGuess(g);
    setPhase("revealed");
  }

  // After the reveal: next round (right country moves left) or game over.
  useEffect(() => {
    if (phase !== "revealed") {
      return;
    }
    const timer = window.setTimeout(() => {
      if (correct) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > best) {
          setBest(newStreak);
          localStorage.setItem(BEST_KEY, String(newStreak));
        }
        setRound(nextRound(pool, round.right));
        setGuess(null);
        setPhase("guessing");
      } else {
        setPhase("over");
      }
    }, REVEAL_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [phase, correct, streak, best, pool, round]);

  function restart() {
    setBestBeforeRun(best);
    setRound(nextRound(pool));
    setStreak(0);
    setGuess(null);
    setPhase("guessing");
  }

  const { left, right, metric } = round;
  return (
    <div className="game">
      <header className="game-header">
        <a className="brand" href="./">
          World Tracker
        </a>
        <div className="scores">
          <span>
            Streak <strong className="streak">{streak}</strong>
          </span>
          <span>
            Best <strong>{best}</strong>
          </span>
        </div>
      </header>

      <main>
        <h1>Higher or Lower</h1>
        <p className="question">
          Does <strong>{right.name}</strong> have a higher or lower <strong>{metric.label}</strong> than{" "}
          <strong>{left.name}</strong>?
        </p>

        <div className="cards" data-metric={metric.key}>
          <CountryCard country={left} label={metric.label} value={metric.format(left[metric.key]!)} />
          <div className="versus">vs</div>
          <CountryCard country={right} label={metric.label} value={phase === "guessing" ? null : metric.format(right[metric.key]!)}>
            {phase === "guessing" ? (
              <div className="guess-buttons">
                <button className="guess higher" data-guess="higher" onClick={() => answer("higher")}>
                  ▲ Higher
                </button>
                <button className="guess lower" data-guess="lower" onClick={() => answer("lower")}>
                  ▼ Lower
                </button>
              </div>
            ) : (
              <div className={correct ? "verdict right-answer" : "verdict wrong-answer"}>{correct ? "✓ Correct" : "✗ Wrong"}</div>
            )}
          </CountryCard>
        </div>

        {phase === "over" && (
          <GameOver streak={streak} best={best} newBest={streak > bestBeforeRun} round={round} onRestart={restart} />
        )}
      </main>
    </div>
  );
}

interface CountryCardProps {
  country: CountrySummary;
  label: string;
  value: string | null; // null = hidden (to be guessed)
  children?: ReactNode;
}

function CountryCard({ country, label, value, children }: CountryCardProps) {
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

interface GameOverProps {
  streak: number;
  best: number;
  newBest: boolean;
  round: Round;
  onRestart: () => void;
}

function GameOver({ streak, best, newBest, round, onRestart }: GameOverProps) {
  const [copied, setCopied] = useState(false);
  const url = new URL("play.html", window.location.href).href;
  const text = `I got ${streak} in a row on World Tracker's Higher or Lower (countries edition). Can you beat it?`;

  function share() {
    const nav: Partial<Navigator> = navigator; // TypeScript assumes share() exists; desktop Firefox lacks it
    if (nav.share !== undefined) {
      navigator.share({ text, url }).catch((e: DOMException) => {
        if (e.name !== "AbortError") {
          throw e; // AbortError = the user closed the share sheet
        }
      });
    } else {
      navigator.clipboard.writeText(`${text} ${url}`).then(() => {
        setCopied(true);
      });
    }
  }

  return (
    <section className="game-over">
      <h2>Game over</h2>
      <p className="final">
        You got <strong>{streak}</strong> in a row{newBest ? " — a new best!" : `. Best: ${best}.`}
      </p>
      <div className="game-over-buttons">
        <button className="primary" onClick={onRestart}>
          Play again
        </button>
        <button onClick={share}>{copied ? "Copied" : "Share score"}</button>
      </div>
      <a className="map-link" href={`./?c=${round.left.id}&vs=${round.right.id}`}>
        Compare {round.left.name} and {round.right.name} on the map →
      </a>
    </section>
  );
}
