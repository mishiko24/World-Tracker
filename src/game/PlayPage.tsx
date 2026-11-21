// Play page (play.html): game modes as tabs, chosen by ?mode= so each has its own link.
//   daily     Daily challenge: 10 Higher-or-Lower questions, same for everyone each day   (Daily.tsx, daily.ts)
//   endless   Higher or Lower until the first wrong answer                                   (HigherLower.tsx, game.ts)
//   flags     Name the country from its flag                                                 (Quiz.tsx, quiz.ts)
//   outlines  Name the country from its shape                                                (Quiz.tsx, quiz.ts)

import { Daily } from "./Daily";
import { HigherLower } from "./HigherLower";
import { Quiz } from "./Quiz";
import { useGameData } from "./shared";

const MODES = [
  { id: "daily", label: "Daily" },
  { id: "endless", label: "Higher or Lower" },
  { id: "flags", label: "Flags" },
  { id: "outlines", label: "Outlines" },
] as const;

type Mode = (typeof MODES)[number]["id"];

function modeFromUrl(): Mode {
  const requested = new URLSearchParams(window.location.search).get("mode");
  return MODES.find((m) => m.id === requested)?.id ?? "daily";
}

export function PlayPage() {
  const data = useGameData();
  const mode = modeFromUrl();
  return (
    <div className="game">
      <header className="game-header">
        <a className="brand" href="./">
          World Tracker
        </a>
        <nav className="mode-tabs">
          {MODES.map((m) => (
            <a key={m.id} href={`?mode=${m.id}`} className={m.id === mode ? "active" : undefined}>
              {m.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        {data === null ? (
          <p className="loading">Loading countries…</p>
        ) : mode === "daily" ? (
          <Daily pool={data.pool} />
        ) : mode === "endless" ? (
          <HigherLower pool={data.pool} />
        ) : (
          <Quiz key={mode} kind={mode} pool={data.pool} nearby={data.nearby} />
        )}
      </main>
    </div>
  );
}
