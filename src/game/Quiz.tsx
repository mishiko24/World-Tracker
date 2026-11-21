// Flag and outline quizzes (rules in quiz.ts): a clue (the flag, or the country's outline), four names to pick from.
// After a pick the right answer turns green (and a wrong pick red) for REVEAL_MS. LIVES wrong answers end the game;
// the score is the number of right answers, best kept per quiz.

import { useEffect, useRef, useState } from "react";
import type { CountrySummary } from "../data/countryData";
import type { Nearby } from "../data/sitePages";
import { loadCountries, type Country } from "../map/geo";
import { drawSilhouette } from "../share/silhouette";
import { flagUrl } from "../ui/Flag";
import { LIVES, nextQuestion, type Question, type QuizKind } from "./quiz";
import { loadBest, playUrl, REVEAL_MS, saveBest, shareScore } from "./shared";

const OUTLINE_COLOR = "#3b82f6";
const PROMPT: Record<QuizKind, string> = { flags: "Which country's flag is this?", outlines: "Which country has this shape?" };
const NAME: Record<QuizKind, string> = { flags: "flag quiz", outlines: "outline quiz" };

interface QuizProps {
  kind: QuizKind;
  pool: CountrySummary[];
  nearby: Nearby;
}

export function Quiz({ kind, pool, nearby }: QuizProps) {
  const shapes = useShapes(kind === "outlines");
  const [asked] = useState(() => new Set<string>());
  const [question, setQuestion] = useState<Question>(() => nextQuestion(pool, nearby, asked));
  const [picked, setPicked] = useState<string | null>(null);
  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => loadBest(kind));
  const over = lives === 0 && picked === null;

  // After the reveal: count the answer, then the next question (or game over when lives run out).
  useEffect(() => {
    if (picked === null) {
      return;
    }
    const right = picked === question.answer.id;
    const timer = window.setTimeout(() => {
      asked.add(question.answer.id);
      if (right) {
        setScore(score + 1);
        if (score + 1 > best) {
          setBest(score + 1);
          saveBest(kind, score + 1);
        }
      } else {
        setLives(lives - 1);
      }
      if (right || lives > 1) {
        setQuestion(nextQuestion(pool, nearby, asked));
      }
      setPicked(null);
    }, REVEAL_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [picked, question, score, best, lives, kind, pool, nearby, asked]);

  function restart() {
    asked.clear();
    setScore(0);
    setLives(LIVES);
    setQuestion(nextQuestion(pool, nearby, asked));
  }

  function optionClass(c: CountrySummary): string {
    if (picked === null) {
      return "option";
    }
    if (c.id === question.answer.id) {
      return "option right";
    }
    return c.id === picked ? "option wrong" : "option";
  }

  return (
    <>
      <div className="scores">
        <span>
          Score <strong className="streak">{score}</strong>
        </span>
        <span>
          Lives <strong className="lives">{"♥\uFE0E".repeat(lives)}</strong>
        </span>
        <span>
          Best <strong>{best}</strong>
        </span>
      </div>
      <p className="question">{PROMPT[kind]}</p>
      <div className="quiz-clue" data-answer={question.answer.id}>
        {kind === "flags" ? (
          <img className="quiz-flag" src={flagUrl(question.answer.id)} alt="Flag to identify" />
        ) : shapes === null ? (
          <p className="loading">Loading shapes…</p>
        ) : (
          <Outline country={shapes.get(question.answer.id)!} />
        )}
      </div>
      {!over && (
        <div className="quiz-options">
          {question.options.map((c) => (
            <button key={c.id} className={optionClass(c)} data-id={c.id} disabled={picked !== null} onClick={() => setPicked(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {over && <QuizOver kind={kind} score={score} best={best} last={question.answer} onRestart={restart} />}
    </>
  );
}

// Country shapes for the outline quiz (the map's own geometry), loaded only when that quiz is open.
function useShapes(needed: boolean): Map<string, Country> | null {
  const [shapes, setShapes] = useState<Map<string, Country> | null>(null);
  useEffect(() => {
    if (needed) {
      loadCountries().then((countries) => setShapes(new Map(countries.map((c) => [c.id, c]))));
    }
  }, [needed]);
  return shapes;
}

const OUTLINE_SIZE = 260;

function Outline({ country }: { country: Country }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ratio = window.devicePixelRatio;
    const el = canvas.current!;
    el.width = OUTLINE_SIZE * ratio;
    el.height = OUTLINE_SIZE * ratio;
    const ctx = el.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, OUTLINE_SIZE, OUTLINE_SIZE);
    drawSilhouette(ctx, country, OUTLINE_COLOR, 10, 10, OUTLINE_SIZE - 20, OUTLINE_SIZE - 20);
  }, [country]);
  return <canvas ref={canvas} className="quiz-outline" style={{ width: OUTLINE_SIZE, height: OUTLINE_SIZE }} aria-label="Country outline to identify" />;
}

interface QuizOverProps {
  kind: QuizKind;
  score: number;
  best: number;
  last: CountrySummary;
  onRestart: () => void;
}

function QuizOver({ kind, score, best, last, onRestart }: QuizOverProps) {
  const [copied, setCopied] = useState(false);
  const text = `I named ${score} countries in World Tracker's ${NAME[kind]}. Can you beat it?`;
  return (
    <section className="game-over">
      <h2>Game over</h2>
      <p className="final">
        <strong>{score}</strong> right{score > 0 && score >= best ? " — your best!" : `. Best: ${best}.`}
      </p>
      <div className="game-over-buttons">
        <button className="primary" onClick={onRestart}>
          Play again
        </button>
        <button onClick={() => shareScore(text, playUrl(kind)).then(setCopied)}>{copied ? "Copied" : "Share score"}</button>
      </div>
      <a className="map-link" href={`./?c=${last.id}`}>
        Learn about {last.name} on the map →
      </a>
    </section>
  );
}
