// Power Level at the top of the info panel: score, world rank and one bar per pillar.
// Comparison mode: both scores side by side (with flags, --flag-a / --flag-b), and two bars per pillar in the
// countries' map colors (--color-a / --color-b, see Compare.tsx). The higher number of each pair is teal.

import { PILLAR_LABELS, PILLAR_ORDER, type CountryData, type PillarId, type PowerLevel } from "../../data/countryData";
import { POWER_LEVEL_METHOD_URL } from "../../links";
import { winner } from "./Compare";

function tooltip(powerLevel: PowerLevel | null): string | undefined {
  return powerLevel === null
    ? undefined
    : `World Tracker's own index of national strength: six pillars (economy, resources, population, energy, food, stability), each scored 0–100 against all countries, weighted into one score.\n\nPower Level v${powerLevel.version}`;
}

function Title({ powerLevel }: { powerLevel: PowerLevel | null }) {
  const hint = tooltip(powerLevel);
  return hint === undefined ? (
    <div className="power-card-title">Power Level</div>
  ) : (
    <div className="power-card-title">
      <span className="has-hint" tabIndex={0} data-hint={hint}>
        Power Level
      </span>
    </div>
  );
}

interface PowerLevelCardProps {
  powerLevel: PowerLevel | null;
  other: CountryData | null; // comparison mode when set
}

export function PowerLevelCard({ powerLevel, other }: PowerLevelCardProps) {
  if (other !== null) {
    return <ComparedCard a={powerLevel} b={other.powerLevel} />;
  }
  if (powerLevel === null) {
    return (
      <div className="power-card">
        <div className="power-card-title">Power Level</div>
        <p className="no-data">Not enough data to score this country.</p>
      </div>
    );
  }
  return (
    <div className="power-card">
      <div className="power-card-head">
        <div>
          <Title powerLevel={powerLevel} />
          <div className="power-score">{powerLevel.score.toFixed(1)}</div>
        </div>
        <div className="power-rank">
          #{powerLevel.rank}
          <span> of {powerLevel.of}</span>
        </div>
      </div>
      <div className="pillars">
        {PILLAR_ORDER.map((pillar) => {
          const value = powerLevel.pillars[pillar];
          return (
            <div className="pillar" key={pillar}>
              <span className="pillar-label">{PILLAR_LABELS[pillar]}</span>
              <span className="pillar-bar">
                <span style={{ width: `${value ?? 0}%` }} />
              </span>
              <span className="pillar-value">{value === null ? "—" : value.toFixed(0)}</span>
            </div>
          );
        })}
      </div>
      <a className="power-method-link" href={POWER_LEVEL_METHOD_URL}>
        How is this calculated?
      </a>
    </div>
  );
}

interface PillarPair {
  pillar: PillarId;
  a: number | null; // rounded, as shown: a "win" is never between two equal-looking numbers
  b: number | null;
  win: "a" | "b" | null;
}

function ComparedCard({ a, b }: { a: PowerLevel | null; b: PowerLevel | null }) {
  const scoreWinner = winner({ a: a?.score ?? null, b: b?.score ?? null, format: String });
  const pairs: PillarPair[] = PILLAR_ORDER.map((pillar) => {
    const va = a?.pillars[pillar] ?? null;
    const vb = b?.pillars[pillar] ?? null;
    const ra = va === null ? null : Math.round(va);
    const rb = vb === null ? null : Math.round(vb);
    return { pillar, a: ra, b: rb, win: winner({ a: ra, b: rb, format: String }) };
  });
  return (
    <div className="power-card comparing">
      <Title powerLevel={a ?? b} />
      <div className="power-versus">
        <ScoreBlock side="a" powerLevel={a} wins={scoreWinner === "a"} />
        <ScoreBlock side="b" powerLevel={b} wins={scoreWinner === "b"} />
      </div>
      <Tally pairs={pairs} />
      <div className="pillars">
        {pairs.map(({ pillar, a: va, b: vb, win }) => (
          <div className="pillar comparing" key={pillar}>
            <span className="pillar-label">{PILLAR_LABELS[pillar]}</span>
            <span className={win === "b" ? "pillar-bar a lose" : "pillar-bar a"}>
              <span style={{ width: `${va ?? 0}%` }} />
            </span>
            <span className={win === "a" ? "pillar-value win" : "pillar-value"}>{va ?? "—"}</span>
            <span className={win === "a" ? "pillar-bar b lose" : "pillar-bar b"}>
              <span style={{ width: `${vb ?? 0}%` }} />
            </span>
            <span className={win === "b" ? "pillar-value win" : "pillar-value"}>{vb ?? "—"}</span>
          </div>
        ))}
      </div>
      <a className="power-method-link" href={POWER_LEVEL_METHOD_URL}>
        How is this calculated?
      </a>
    </div>
  );
}

// "1 · categories won · 5", as on the share card. Only over pillars both countries have.
function Tally({ pairs }: { pairs: PillarPair[] }) {
  const both = pairs.filter((p) => p.a !== null && p.b !== null);
  if (both.length === 0) {
    return null;
  }
  return (
    <div className="power-tally">
      <span className="tally-a">{both.filter((p) => p.win === "a").length}</span>
      categories won
      <span className="tally-b">{both.filter((p) => p.win === "b").length}</span>
    </div>
  );
}

function ScoreBlock({ side, powerLevel, wins }: { side: "a" | "b"; powerLevel: PowerLevel | null; wins: boolean }) {
  return (
    <div className={`power-side ${side}`}>
      <div className={wins ? "power-score win" : "power-score"}>{powerLevel === null ? "—" : powerLevel.score.toFixed(1)}</div>
      <div className="power-side-rank">
        <span className={`flag flag-small flag-${side}`} />
        {powerLevel === null ? "Not scored" : `#${powerLevel.rank} of ${powerLevel.of}`}
      </div>
    </div>
  );
}
