// Resources: Production and Reserves tabs over the same resource list (energy, then minerals).
// In comparison mode each row also shows the other country's amount of the same resource.

import { useState } from "react";
import type { Amount, CountryData, Resource } from "../../data/countryData";
import { FactRow } from "./FactRow";
import { amount, share } from "./formatData";

type Tab = "production" | "reserves";

interface ResourcesSectionProps {
  resources: Resource[];
  other: CountryData | null;
}

export function ResourcesSection({ resources, other }: ResourcesSectionProps) {
  const [tab, setTab] = useState<Tab>("production");

  if (resources.length === 0) {
    return <p className="no-data">No energy or mineral production or reserves recorded.</p>;
  }

  const energy = resources.filter((r) => r.category === "energy");
  const minerals = resources.filter((r) => r.category === "mineral");

  return (
    <>
      <div className="tabs">
        <button className={tab === "production" ? "tab active" : "tab"} onClick={() => setTab("production")}>
          Production
        </button>
        <button className={tab === "reserves" ? "tab active" : "tab"} onClick={() => setTab("reserves")}>
          Reserves
        </button>
      </div>
      {energy.length > 0 && <ResourceGroup title="Energy" resources={energy} tab={tab} other={other} />}
      {minerals.length > 0 && <ResourceGroup title="Minerals & metals" resources={minerals} tab={tab} other={other} />}
    </>
  );
}

interface ResourceGroupProps {
  title: string;
  resources: Resource[];
  tab: Tab;
  other: CountryData | null;
}

function ResourceGroup({ title, resources, tab, other }: ResourceGroupProps) {
  return (
    <div className="data-group">
      <div className="data-group-title">{title}</div>
      {resources.map((r) => {
        const value = r[tab];
        const otherValue = other === null ? undefined : (other.resources.find((o) => o.id === r.id)?.[tab] ?? null);
        return <AmountRow key={r.id} name={r.name} value={value} other={otherValue} />;
      })}
    </div>
  );
}

function rankLine(value: Amount): string {
  const parts: string[] = [];
  if (value.worldRank !== null) {
    parts.push(`#${value.worldRank} world`);
  }
  if (value.worldShare !== null) {
    parts.push(share(value.worldShare));
  }
  return parts.join(" · ");
}

// Same resource id = same unit, so values can be compared directly.
function AmountRow({ name, value, other }: { name: string; value: Amount | null; other: Amount | null | undefined }) {
  const unit = value ?? other;
  const format = (v: number) => amount({ ...unit!, value: v });
  return (
    <FactRow
      label={name}
      value={value === null ? null : amount(value)}
      year={value?.year}
      source={value?.source}
      meta={value && rankLine(value)}
      compare={other === undefined ? undefined : { a: value?.value ?? null, b: other?.value ?? null, format }}
    />
  );
}
