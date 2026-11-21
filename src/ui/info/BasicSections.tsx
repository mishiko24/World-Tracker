// Government, Population and Economy: plain lists of facts.
// `other` is the compared country's data (comparison mode) or null. Rows with history get a trend chart (TrendChart.tsx).

import type { CountryData, Economy, Government, NumberFact, Population, Trends } from "../../data/countryData";
import type { Better, DiffMode } from "./Compare";
import { FactRow } from "./FactRow";
import { dollars, percent, shortNumber } from "./formatData";
import { TrendRow, trendOf, type TrendInput } from "./TrendChart";

interface NumberRowProps {
  label: string;
  fact: NumberFact | null;
  other: NumberFact | null | undefined; // undefined = not comparing
  format: (value: number) => string;
  mode?: DiffMode;
  better?: Better;
  trend?: TrendInput;
}

function NumberRow({ label, fact, other, format, mode, better, trend }: NumberRowProps) {
  return (
    <TrendRow
      label={label}
      trend={trend}
      row={(shownLabel) => (
        <FactRow
          label={shownLabel}
          value={fact === null ? null : format(fact.value)}
          year={fact?.year}
          source={fact?.source}
          compare={other === undefined ? undefined : { a: fact?.value ?? null, b: other?.value ?? null, format, mode, better }}
        />
      )}
    />
  );
}

export function GovernmentSection({ government, other }: { government: Government; other: CountryData | null }) {
  return (
    <>
      <FactRow
        label="Government type"
        value={government.type?.value ?? null}
        source={government.type?.source}
        compareText={other === null ? undefined : (other.government.type?.value ?? null)}
      />
      <FactRow
        label="Ruling party"
        value={government.rulingParty?.value ?? null}
        source={government.rulingParty?.source}
        compareText={other === null ? undefined : (other.government.rulingParty?.value ?? null)}
      />
      <FactRow
        label="Head of state"
        value={government.headOfState?.value ?? null}
        source={government.headOfState?.source}
        compareText={other === null ? undefined : (other.government.headOfState?.value ?? null)}
      />
      <FactRow
        label="Head of government"
        value={government.headOfGovernment?.value ?? null}
        source={government.headOfGovernment?.source}
        compareText={other === null ? undefined : (other.government.headOfGovernment?.value ?? null)}
      />
      <NumberRow
        label="Political stability"
        fact={government.politicalStability}
        other={other?.government.politicalStability}
        format={(v) => `${v.toFixed(0)} / 100`}
        mode="score"
      />
    </>
  );
}

function years(value: number): string {
  return `${value.toFixed(1)} years`;
}

function wholePercent(value: number): string {
  return percent(value, 0);
}

const AGE_ROWS = [
  { label: "Age 0–14", key: "under15" },
  { label: "Age 15–64", key: "from15to64" },
  { label: "Age 65+", key: "over65" },
] as const;

interface SectionProps {
  trends: Trends;
  other: CountryData | null;
}

export function PopulationSection({ population, trends, other }: SectionProps & { population: Population }) {
  const b = other?.population;
  const age = population.ageStructure;
  const otherAge = b?.ageStructure ?? null;
  return (
    <>
      <NumberRow
        label="Population"
        fact={population.total}
        other={b?.total}
        format={shortNumber}
        trend={trendOf("population", trends, other, shortNumber)}
      />
      <NumberRow
        label="Children per woman"
        fact={population.fertility}
        other={b?.fertility}
        format={(v) => v.toFixed(2)}
        trend={trendOf("fertility", trends, other, (v) => v.toFixed(2))}
      />
      <NumberRow
        label="Life expectancy"
        fact={population.lifeExpectancy}
        other={b?.lifeExpectancy}
        format={years}
        mode="years"
        trend={trendOf("lifeExpectancy", trends, other, years)}
      />
      <NumberRow
        label="Median age"
        fact={population.medianAge}
        other={b?.medianAge}
        format={years}
        mode="years"
        better="none"
      />
      {AGE_ROWS.map(({ label, key }) => (
        <FactRow
          key={key}
          label={label}
          value={age === null ? null : wholePercent(age[key])}
          year={age?.year}
          source={age?.source}
          compare={
            other === null
              ? undefined
              : { a: age?.[key] ?? null, b: otherAge?.[key] ?? null, format: wholePercent, mode: "points", better: "none" }
          }
        />
      ))}
      <NumberRow
        label="Population density"
        fact={population.density}
        other={b?.density}
        format={(v) => `${shortNumber(v)} per km²`}
        better="none"
      />
    </>
  );
}

export function EconomySection({ economy, trends, other }: SectionProps & { economy: Economy }) {
  const b = other?.economy;
  const rank = economy.gdpRank;
  return (
    <>
      <TrendRow
        label="GDP"
        trend={trendOf("gdp", trends, other, dollars)}
        row={(shownLabel) => (
          <FactRow
            label={shownLabel}
            value={economy.gdp === null ? null : dollars(economy.gdp.value)}
            year={economy.gdp?.year}
            source={economy.gdp?.source}
            meta={rank && `#${rank.rank} of ${rank.of}`}
            compare={other === null ? undefined : { a: economy.gdp?.value ?? null, b: b?.gdp?.value ?? null, format: dollars }}
          />
        )}
      />
      <NumberRow
        label="GDP per capita"
        fact={economy.gdpPerCapita}
        other={b?.gdpPerCapita}
        format={dollars}
        trend={trendOf("gdpPerCapita", trends, other, dollars)}
      />
      <NumberRow
        label="GDP per capita (PPP)"
        fact={economy.gdpPerCapitaPpp}
        other={b?.gdpPerCapitaPpp}
        format={dollars}
        trend={trendOf("gdpPerCapitaPpp", trends, other, dollars)}
      />
      <NumberRow
        label="Real growth"
        fact={economy.growth}
        other={b?.growth}
        format={(v) => percent(v)}
        mode="points"
        trend={trendOf("growth", trends, other, (v) => percent(v))}
      />
      <NumberRow
        label="Inflation"
        fact={economy.inflation}
        other={b?.inflation}
        format={(v) => percent(v)}
        mode="points"
        better="lower"
        trend={trendOf("inflation", trends, other, (v) => percent(v))}
      />
      <NumberRow label="Central gov. debt" fact={economy.debtUsd} other={b?.debtUsd} format={dollars} better="lower" />
      <NumberRow
        label="Debt, % of GDP"
        fact={economy.debt}
        other={b?.debt}
        format={wholePercent}
        mode="points"
        better="lower"
      />
    </>
  );
}
