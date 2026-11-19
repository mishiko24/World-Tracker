// Power generation: total, a stacked bar of the mix, and one row per source. Rows add up to the total.

import type { Power, PowerSource } from "../../data/countryData";
import { FactRow, SourceNote } from "./FactRow";
import { percent, shortNumber } from "./formatData";

const SOURCE_STYLE: Record<PowerSource, { label: string; color: string }> = {
  coal: { label: "Coal", color: "#6b6b6b" },
  gas: { label: "Gas", color: "#e07b39" },
  oil: { label: "Oil", color: "#8b5a2b" },
  nuclear: { label: "Nuclear", color: "#a874d6" },
  hydro: { label: "Hydro", color: "#3d8fe0" },
  wind: { label: "Wind", color: "#4fd1b5" },
  solar: { label: "Solar", color: "#f2cf45" },
  bioenergy: { label: "Bioenergy", color: "#6cc56c" },
  other: { label: "Geothermal & other", color: "#e05a5a" },
};

function twh(value: number): string {
  return value >= 100 ? `${shortNumber(value)} TWh` : `${value.toFixed(value < 1 ? 2 : 1)} TWh`;
}

export function PowerSection({ power }: { power: Power }) {
  const generation = power.generation;
  const access = power.electricityAccess;

  return (
    <>
      {generation === null ? (
        <FactRow label="Total generation" value={null} />
      ) : (
        <>
          <FactRow label="Total generation" value={twh(generation.totalTwh)} year={generation.year} source={generation.source} />
          <div className="power-bar">
            {generation.mix.map((m) => (
              <span
                key={m.source}
                style={{ width: `${(m.twh / generation.totalTwh) * 100}%`, background: SOURCE_STYLE[m.source].color }}
                title={SOURCE_STYLE[m.source].label}
              />
            ))}
          </div>
          {generation.mix.map((m) => (
            <div className="fact" key={m.source}>
              <span className="fact-label">
                <span className="swatch" style={{ background: SOURCE_STYLE[m.source].color }} />
                {SOURCE_STYLE[m.source].label}
              </span>
              <span className="fact-value">
                {twh(m.twh)}
                <span className="fact-meta">{percent((m.twh / generation.totalTwh) * 100)}</span>
              </span>
            </div>
          ))}
          <div className="fact total-row">
            <span className="fact-label">Total</span>
            <span className="fact-value">
              {twh(generation.totalTwh)}
              <SourceNote year={generation.year} source={generation.source} />
            </span>
          </div>
        </>
      )}
      <FactRow
        label="Access to electricity"
        value={access === null ? null : percent(access.value)}
        year={access?.year}
        source={access?.source}
      />
    </>
  );
}
