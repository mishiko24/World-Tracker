// Power Level at the top of the info panel: score, world rank and one bar per pillar.
// In comparison mode the score and every pillar get a comparison chip (points, higher = better).

import type { CountryData, PillarId, PowerLevel } from "../../data/countryData";
import { Compare } from "./Compare";

export const PILLAR_LABELS: Record<PillarId, string> = {
  economy: "Economy",
  resources: "Resources",
  population: "Population",
  energy: "Energy",
  food: "Food",
  stability: "Stability",
};

const PILLAR_ORDER: PillarId[] = ["economy", "resources", "population", "energy", "food", "stability"];

function oneDecimal(value: number): string {
  return value.toFixed(1);
}

interface PowerLevelCardProps {
  powerLevel: PowerLevel | null;
  other: CountryData | null;
}

export function PowerLevelCard({ powerLevel, other }: PowerLevelCardProps) {
  const otherLevel = other?.powerLevel ?? null;
  if (powerLevel === null) {
    return (
      <div className="power-card">
        <div className="power-card-title">Power Level</div>
        <p className="no-data">Not enough data to score this country.</p>
      </div>
    );
  }
  return (
    <div className="power-card" title={`Power Level v${powerLevel.version}: World Tracker's own index. See Sources & method.`}>
      <div className="power-card-head">
        <div>
          <div className="power-card-title">Power Level</div>
          <div className="power-score">
            {oneDecimal(powerLevel.score)}
            {other !== null && (
              <Compare a={powerLevel.score} b={otherLevel?.score ?? null} format={oneDecimal} mode="points" />
            )}
          </div>
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
              <span className="pillar-value">
                {value === null ? "—" : value.toFixed(0)}
                {other !== null && (
                  <Compare a={value} b={otherLevel?.pillars[pillar] ?? null} format={(v) => v.toFixed(0)} mode="points" />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
