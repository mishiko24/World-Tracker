// Resources: Production and Reserves tabs over the same resource list (energy, then minerals).

import { useState } from "react";
import type { Amount, Resource } from "../../data/countryData";
import { SourceNote } from "./FactRow";
import { amount, share } from "./formatData";

type Tab = "production" | "reserves";

export function ResourcesSection({ resources }: { resources: Resource[] }) {
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
      {energy.length > 0 && <ResourceGroup title="Energy" resources={energy} tab={tab} />}
      {minerals.length > 0 && <ResourceGroup title="Minerals & metals" resources={minerals} tab={tab} />}
    </>
  );
}

function ResourceGroup({ title, resources, tab }: { title: string; resources: Resource[]; tab: Tab }) {
  return (
    <div className="data-group">
      <div className="data-group-title">{title}</div>
      {resources.map((r) => (
        <AmountRow key={r.id} name={r.name} value={r[tab]} />
      ))}
    </div>
  );
}

function AmountRow({ name, value }: { name: string; value: Amount | null }) {
  return (
    <div className="fact">
      <span className="fact-label">{name}</span>
      <span className="fact-value">
        {value === null ? (
          <span className="no-data">No data</span>
        ) : (
          <>
            {amount(value)}
            <span className="fact-meta">
              {value.worldRank !== null && `#${value.worldRank} world`}
              {value.worldShare !== null && ` · ${share(value.worldShare)}`}
            </span>
            <SourceNote year={value.year} source={value.source} />
          </>
        )}
      </span>
    </div>
  );
}
