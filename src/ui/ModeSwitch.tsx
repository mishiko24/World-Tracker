// Map | Play switch at the top of the map (App.tsx) and the games page (src/game/PlayPage.tsx), so the two are
// always one click apart. Play shows a dot until today's daily challenge is done.
// Going to Play remembers the map's URL (selection, comparison, list view) for the way back.

import { DAILY_ROUNDS, loadDailyResults, todayKey } from "../game/daily";
import { GAME_URL } from "../links";
import "./modeSwitch.css";

const MAP_VIEW_KEY = "worldTracker.mapView"; // sessionStorage: the map's ?query when the player left for Play

function dailyPending(): boolean {
  return loadDailyResults(todayKey()).length < DAILY_ROUNDS;
}

export function ModeSwitch({ active }: { active: "map" | "play" }) {
  const mapHref = `./${active === "play" ? (sessionStorage.getItem(MAP_VIEW_KEY) ?? "") : ""}`;
  return (
    <nav className="mode-switch" aria-label="Map or games">
      <a href={mapHref} className={active === "map" ? "active" : undefined} aria-current={active === "map" ? "page" : undefined}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" />
          <path d="M1.8 8h12.4M8 1.8c2 2.2 2 10.2 0 12.4M8 1.8c-2 2.2-2 10.2 0 12.4" />
        </svg>
        Map
      </a>
      <a
        href={GAME_URL}
        className={active === "play" ? "play active" : "play"}
        aria-current={active === "play" ? "page" : undefined}
        onClick={() => {
          if (active === "map") {
            sessionStorage.setItem(MAP_VIEW_KEY, window.location.search);
          }
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="4.5" width="13" height="8" rx="3" />
          <path d="M4.5 8.5h3M6 7v3" />
          <circle cx="10.5" cy="8" r="0.6" />
          <circle cx="12" cy="9.5" r="0.6" />
        </svg>
        Play
        {active === "map" && dailyPending() && <span className="daily-dot" title="Today's challenge is waiting" />}
      </a>
    </nav>
  );
}
