// Government, Population and Economy: plain lists of facts.

import type { Economy, Government, NumberFact, Population } from "../../data/countryData";
import { FactRow } from "./FactRow";
import { dollars, percent, shortNumber } from "./formatData";

// Renders a NumberFact row with a formatter, or "No data".
function NumberRow({ label, fact, format }: { label: string; fact: NumberFact | null; format: (v: number) => string }) {
  if (fact === null) {
    return <FactRow label={label} value={null} />;
  }
  return <FactRow label={label} value={format(fact.value)} year={fact.year} source={fact.source} />;
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

export function PopulationSection({ population }: { population: Population }) {
  const age = population.ageStructure;
  return (
    <>
      <NumberRow label="Population" fact={population.total} format={shortNumber} />
      <NumberRow label="Children per woman" fact={population.fertility} format={(v) => v.toFixed(2)} />
      <NumberRow label="Life expectancy" fact={population.lifeExpectancy} format={(v) => `${v.toFixed(1)} years`} />
      <NumberRow label="Median age" fact={population.medianAge} format={(v) => `${v.toFixed(1)} years`} />
      <FactRow
        label="Age structure"
        value={
          age === null ? null : (
            <span className="age-structure">
              <span>0–14: {percent(age.under15, 0)}</span>
              <span>15–64: {percent(age.from15to64, 0)}</span>
              <span>65+: {percent(age.over65, 0)}</span>
            </span>
          )
        }
        year={age?.year}
        source={age?.source}
      />
      <NumberRow label="Population density" fact={population.density} format={(v) => `${shortNumber(v)} per km²`} />
    </>
  );
}

export function EconomySection({ economy }: { economy: Economy }) {
  const rank = economy.gdpRank;
  return (
    <>
      <FactRow
        label="GDP"
        value={
          economy.gdp === null ? null : (
            <>
              {dollars(economy.gdp.value)}
              {rank && <span className="rank-badge">#{rank.rank} of {rank.of}</span>}
            </>
          )
        }
        year={economy.gdp?.year}
        source={economy.gdp?.source}
      />
      <NumberRow label="GDP per capita" fact={economy.gdpPerCapita} format={dollars} />
      <NumberRow label="GDP per capita (PPP)" fact={economy.gdpPerCapitaPpp} format={dollars} />
      <NumberRow label="Real growth" fact={economy.growth} format={(v) => percent(v)} />
      <NumberRow label="Inflation" fact={economy.inflation} format={(v) => percent(v)} />
      <NumberRow label="Government debt" fact={economy.debt} format={(v) => `${percent(v, 0)} of GDP`} />
    </>
  );
}
