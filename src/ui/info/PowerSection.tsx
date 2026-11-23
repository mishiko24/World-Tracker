// Power generation: total, a stacked bar of the mix, and one row per source. Rows add up to the total.
// In comparison mode each row also shows the other country's generation from the same source.

import type { CountryData, Power, PowerSource, Trends } from "../../data/countryData";
import type { Comparison } from "./Compare";
import { FactRow } from "./FactRow";
import { percent, shortNumber } from "./formatData";
import { METRIC_HINTS, powerSourceHint } from "./hints";
import { TrendRow, trendOf } from "./TrendChart";

export const POWER_SOURCE_STYLE: Record<PowerSource, { label: string; color: string }> = {
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

export function PowerSection({ power, trends, other }: { power: Power; trends: Trends; other: CountryData | null }) {
  const generation = power.generation;
  const access = power.electricityAccess;
  const comparing = other !== null;
  const otherGeneration = other?.power.generation ?? null;
  const otherTotal = otherGeneration?.totalTwh ?? null;
  const otherTwh = (source: PowerSource) => otherGeneration?.mix.find((m) => m.source === source)?.twh ?? null;
  const compareTwh = (a: number | null, b: number | null): Comparison | undefined =>
    comparing ? { a, b, format: twh } : undefined;

  return (
    <>
      {generation === null ? (
        <FactRow label="Total generation" value={null} compare={compareTwh(null, otherTotal)} />
      ) : (
        <>
          <FactRow
            label="Total generation"
            value={twh(generation.totalTwh)}
            year={generation.year}
            source={generation.source}
            compare={compareTwh(generation.totalTwh, otherTotal)}
          />
          <div className="power-bar">
            {generation.mix.map((m) => (
              <span
                key={m.source}
                style={{ width: `${(m.twh / generation.totalTwh) * 100}%`, background: POWER_SOURCE_STYLE[m.source].color }}
                title={POWER_SOURCE_STYLE[m.source].label}
              />
            ))}
          </div>
          {generation.mix.map((m) => (
            <FactRow
              key={m.source}
              label={
                <>
                  <span className="swatch" style={{ background: POWER_SOURCE_STYLE[m.source].color }} />
                  {POWER_SOURCE_STYLE[m.source].label}
                </>
              }
              hint={powerSourceHint(POWER_SOURCE_STYLE[m.source].label)}
              value={twh(m.twh)}
              meta={percent((m.twh / generation.totalTwh) * 100)}
              compare={compareTwh(m.twh, otherTwh(m.source))}
            />
          ))}
          <div className="total-row">
            <FactRow
              label="Total"
              value={twh(generation.totalTwh)}
              year={generation.year}
              source={generation.source}
              compare={compareTwh(generation.totalTwh, otherTotal)}
            />
          </div>
        </>
      )}
      <TrendRow
        label="Access to electricity"
        trend={trendOf("electricityAccess", trends, other, (v) => percent(v))}
        row={(shownLabel) => (
          <FactRow
            label={shownLabel}
            hint={METRIC_HINTS["Access to electricity"]}
            value={access === null ? null : percent(access.value)}
            year={access?.year}
            source={access?.source}
            compare={
              comparing
                ? { a: access?.value ?? null, b: other.power.electricityAccess?.value ?? null, format: (v) => percent(v), mode: "points" }
                : undefined
            }
          />
        )}
      />
    </>
  );
}
