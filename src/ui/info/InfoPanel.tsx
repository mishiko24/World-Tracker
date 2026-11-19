// Right sidebar: info about the selected country, one collapsible section per topic.
// Stays mounted while switching countries, so open sections stay open.

import type { Country } from "../../map/geo";
import { Collapsible } from "../Collapsible";
import { AgricultureSection } from "./AgricultureSection";
import { EconomySection, GovernmentSection, PopulationSection } from "./BasicSections";
import { PowerSection } from "./PowerSection";
import { ResourcesSection } from "./ResourcesSection";
import { useCountryData, type CountryDataState } from "./useCountryData";
import type { CountryData } from "../../data/countryData";
import type { ReactNode } from "react";

// Section body: the content once data is loaded, otherwise a loading or error message.
function loaded(state: CountryDataState, render: (data: CountryData) => ReactNode): ReactNode {
  if (state.status === "loading") {
    return <p className="panel-message">Loading…</p>;
  }
  if (state.status === "failed") {
    return <p className="panel-message error">Couldn't load data: {state.message}</p>;
  }
  return render(state.data);
}

interface InfoPanelProps {
  country: Country;
  onClose: () => void;
}

export function InfoPanel({ country, onClose }: InfoPanelProps) {
  const state = useCountryData(country.id);

  return (
    <aside className="panel panel-right">
      <header className="panel-header">
        <h2>{country.name}</h2>
        <button className="icon-button" onClick={onClose} title="Deselect">
          ✕
        </button>
      </header>

      {/* Sections are always rendered (even while loading) so their open/closed state survives country switches. */}
      <div className="panel-scroll">
        <Collapsible title="Government">
          {loaded(state, (d) => <GovernmentSection government={d.government} />)}
        </Collapsible>
        <Collapsible title="Population">
          {loaded(state, (d) => <PopulationSection population={d.population} />)}
        </Collapsible>
        <Collapsible title="Economy">
          {loaded(state, (d) => <EconomySection economy={d.economy} />)}
        </Collapsible>
        <Collapsible title="Resources">
          {loaded(state, (d) => <ResourcesSection resources={d.resources} />)}
        </Collapsible>
        <Collapsible title="Agriculture">
          {loaded(state, (d) => <AgricultureSection agriculture={d.agriculture} />)}
        </Collapsible>
        <Collapsible title="Power generation">
          {loaded(state, (d) => <PowerSection power={d.power} />)}
        </Collapsible>
      </div>
    </aside>
  );
}
