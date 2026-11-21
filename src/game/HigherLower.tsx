// Higher or Lower, endless: rules in game.ts. One wrong answer ends the run; the streak is the score.
//   guessing  left value visible, right value hidden, Higher / Lower buttons
//   revealed  right value shown with ✓ or ✗ for REVEAL_MS, then the next round or game over
//   over      streak, best, play again, share score, open the last pair on the map

import { useEffect, useState } from "react";
import type { CountrySummary } from "../data/countryData";
import { correctGuess, nextRound, type Guess, type Round } from "./game";
import { CountryCard, loadBest, playUrl, REVEAL_MS, saveBest, shareScore } from "./shared";

const BEST_KEY = "higherLower";

type Phase = "guessing" | "revealed" | "over";

export function HigherLower({ pool }: { pool: CountrySummary[] }) {
  const [round, setRound] = useState<Round>(() => nextRound(pool, null));
  const [phase, setPhase] = useState<Phase>("guessing");
  const [guess, setGuess] = useState<Guess | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => loadBest(BEST_KEY));
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
          saveBest(BEST_KEY, newStreak);
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
    setRound(nextRound(pool, null));
    setStreak(0);
    setGuess(null);
    setPhase("guessing");
  }

  const { left, right, metric } = round;
  return (
    <>
      <div className="scores">
        <span>
          Streak <strong className="streak">{streak}</strong>
        </span>
        <span>
          Best <strong>{best}</strong>
        </span>
      </div>
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
    </>
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
  const text = `I got ${streak} in a row on World Tracker's Higher or Lower (countries edition). Can you beat it?`;

  function share() {
    shareScore(text, playUrl("endless")).then(setCopied);
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
