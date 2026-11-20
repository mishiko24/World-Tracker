// Power Level at the top of the info panel: score, world rank and one bar per pillar.
// Comparison mode: both scores side by side, and two bars per pillar in the countries' map colors
// (--color-a / --color-b, see Compare.tsx). The higher number of each pair is green.

import type { CountryData, PillarId, PowerLevel } from "../../data/countryData";
import { winner } from "./Compare";

export const PILLAR_LABELS: Record<PillarId, string> = {
  economy: "Economy",
  resources: "Resources",
  population: "Population",
  energy: "Energy",
  food: "Food",
  stability: "Stability",
};

const PILLAR_ORDER: PillarId[] = ["economy", "resources", "population", "energy", "food", "stability"];

function tooltip(powerLevel: PowerLevel | null): string | undefined {
  return powerLevel === null ? undefined : `Power Level v${powerLevel.version}: World Tracker's own index. See Sources & method.`;
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
    <div className="power-card" title={tooltip(powerLevel)}>
      <div className="power-card-head">
        <div>
          <div className="power-card-title">Power Level</div>
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
    </div>
  );
}

function ComparedCard({ a, b }: { a: PowerLevel | null; b: PowerLevel | null }) {
  const scoreWinner = winner({ a: a?.score ?? null, b: b?.score ?? null, format: String });
  return (
    <div className="power-card comparing" title={tooltip(a ?? b)}>
      <div className="power-card-title">Power Level</div>
      <div className="power-versus">
        <ScoreBlock side="a" powerLevel={a} wins={scoreWinner === "a"} />
        <ScoreBlock side="b" powerLevel={b} wins={scoreWinner === "b"} />
      </div>
      <div className="pillars">
        {PILLAR_ORDER.map((pillar) => {
          const va = a?.pillars[pillar] ?? null;
          const vb = b?.pillars[pillar] ?? null;
          const win = winner({ a: va, b: vb, format: String });
          return (
            <div className="pillar comparing" key={pillar}>
              <span className="pillar-label">{PILLAR_LABELS[pillar]}</span>
              <span className="pillar-bar a">
                <span style={{ width: `${va ?? 0}%` }} />
              </span>
              <span className={win === "a" ? "pillar-value win" : "pillar-value"}>{va === null ? "—" : va.toFixed(0)}</span>
              <span className="pillar-bar b">
                <span style={{ width: `${vb ?? 0}%` }} />
              </span>
              <span className={win === "b" ? "pillar-value win" : "pillar-value"}>{vb === null ? "—" : vb.toFixed(0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreBlock({ side, powerLevel, wins }: { side: "a" | "b"; powerLevel: PowerLevel | null; wins: boolean }) {
  return (
    <div className={`power-side ${side}`}>
      <div className={wins ? "power-score win" : "power-score"}>{powerLevel === null ? "—" : powerLevel.score.toFixed(1)}</div>
      <div className="power-side-rank">{powerLevel === null ? "Not scored" : `#${powerLevel.rank} of ${powerLevel.of}`}</div>
    </div>
  );
}
