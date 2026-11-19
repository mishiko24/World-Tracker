// Government, Population and Economy: plain lists of facts.
// `other` is the compared country's data (comparison mode) or null.

import type { CountryData, Economy, Government, NumberFact, Population } from "../../data/countryData";
import { Compare, type Better, type DiffMode } from "./Compare";
import { FactRow } from "./FactRow";
import { dollars, percent, shortNumber } from "./formatData";

interface NumberRowProps {
  label: string;
  fact: NumberFact | null;
  other: NumberFact | null | undefined; // undefined = not comparing
  format: (value: number) => string;
  mode?: DiffMode;
  better?: Better;
}

function NumberRow({ label, fact, other, format, mode, better }: NumberRowProps) {
  return (
    <FactRow
      label={label}
      value={fact === null ? null : format(fact.value)}
      year={fact?.year}
      source={fact?.source}
      compare={
        other !== undefined && (
          <Compare a={fact?.value ?? null} b={other?.value ?? null} format={format} mode={mode} better={better} />
        )
      }
    />
  );
}

export function GovernmentSection({ government }: { government: Government }) {
  return (
    <>
      <FactRow label="Government type" value={government.type?.value ?? null} source={government.type?.source} />
      <FactRow label="Ruling party" value={government.rulingParty?.value ?? null} source={government.rulingParty?.source} />
      <FactRow label="Head of state" value={government.headOfState?.value ?? null} source={government.headOfState?.source} />
      <FactRow
        label="Head of government"
        value={government.headOfGovernment?.value ?? null}
        source={government.headOfGovernment?.source}
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

export function PopulationSection({ population, other }: { population: Population; other: CountryData | null }) {
  const b = other?.population;
  const age = population.ageStructure;
  const otherAge = b?.ageStructure ?? null;
  return (
    <>
      <NumberRow label="Population" fact={population.total} other={b?.total} format={shortNumber} />
      <NumberRow label="Children per woman" fact={population.fertility} other={b?.fertility} format={(v) => v.toFixed(2)} />
      <NumberRow label="Life expectancy" fact={population.lifeExpectancy} other={b?.lifeExpectancy} format={years} />
      <NumberRow label="Median age" fact={population.medianAge} other={b?.medianAge} format={years} />
      {AGE_ROWS.map(({ label, key }) => (
        <FactRow
          key={key}
          label={label}
          value={age === null ? null : wholePercent(age[key])}
          year={age?.year}
          source={age?.source}
          compare={
            other !== null && (
              <Compare a={age?.[key] ?? null} b={otherAge?.[key] ?? null} format={wholePercent} mode="points" />
            )
          }
        />
      ))}
      <NumberRow
        label="Population density"
        fact={population.density}
        other={b?.density}
        format={(v) => `${shortNumber(v)} per km²`}
      />
    </>
  );
}

export function EconomySection({ economy, other }: { economy: Economy; other: CountryData | null }) {
  const b = other?.economy;
  const rank = economy.gdpRank;
  return (
    <>
      <FactRow
        label="GDP"
        value={economy.gdp === null ? null : dollars(economy.gdp.value)}
        year={economy.gdp?.year}
        source={economy.gdp?.source}
        meta={rank && `#${rank.rank} of ${rank.of}`}
        compare={other !== null && <Compare a={economy.gdp?.value ?? null} b={b?.gdp?.value ?? null} format={dollars} />}
      />
      <NumberRow label="GDP per capita" fact={economy.gdpPerCapita} other={b?.gdpPerCapita} format={dollars} />
      <NumberRow label="GDP per capita (PPP)" fact={economy.gdpPerCapitaPpp} other={b?.gdpPerCapitaPpp} format={dollars} />
      <NumberRow label="Real growth" fact={economy.growth} other={b?.growth} format={(v) => percent(v)} mode="points" />
      <NumberRow
        label="Inflation"
        fact={economy.inflation}
        other={b?.inflation}
        format={(v) => percent(v)}
        mode="points"
        better="lower"
      />
      <NumberRow label="Government debt" fact={economy.debtUsd} other={b?.debtUsd} format={dollars} better="lower" />
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
