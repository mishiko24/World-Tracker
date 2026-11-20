// Right sidebar: info about the selected country, one collapsible section per topic.
// Stays mounted while switching countries, so open sections stay open.
// Comparison mode: when another country is right-clicked, every number also shows that country's value.

import type { ReactNode } from "react";
import type { CountryData } from "../../data/countryData";
import type { Country } from "../../map/geo";
import { Collapsible } from "../Collapsible";
import { AgricultureSection } from "./AgricultureSection";
import { EconomySection, GovernmentSection, PopulationSection } from "./BasicSections";
import { PowerLevelCard } from "./PowerLevelCard";
import { PowerSection } from "./PowerSection";
import { ResourcesSection } from "./ResourcesSection";
import { useCountryData, type CountryDataState } from "./useCountryData";

// Section body: the content once data is loaded, otherwise a loading or error message.
function loaded(state: CountryDataState, render: (data: CountryData) => ReactNode): ReactNode {
  if (state.status === "loading") {
    return <p className="panel-message">Loading…</p>;
  }
  if (state.status === "failed") {
    return <p className="panel-message error">Couldn't load data: {state.message}</p>;
  }
  if (state.status === "none") {
    return null;
  }
  return render(state.data);
}

interface InfoPanelProps {
  country: Country;
  compared: Country | null;
  onClose: () => void;
  onEndComparison: () => void;
}

export function InfoPanel({ country, compared, onClose, onEndComparison }: InfoPanelProps) {
  const state = useCountryData(country.id);
  const comparedState = useCountryData(compared?.id ?? null);
  // Comparison numbers appear once the other country's data has loaded.
  const other = comparedState.status === "loaded" ? comparedState.data : null;

  return (
    <aside className="panel panel-right">
      <header className="panel-header">
        <div>
          <h2>{country.name}</h2>
          {compared && (
            <div className="compare-header">
              <span className="compare-swatch" />
              vs {compared.name}
              <button className="icon-button small" onClick={onEndComparison} title="End comparison">
                ✕
              </button>
              {comparedState.status === "failed" && <span className="error"> couldn't load: {comparedState.message}</span>}
            </div>
          )}
        </div>
        <button className="icon-button" onClick={onClose} title="Deselect">
          ✕
        </button>
      </header>

      {/* Sections are always rendered (even while loading) so their open/closed state survives country switches. */}
      <div className="panel-scroll">
        {state.status === "loaded" && <PowerLevelCard powerLevel={state.data.powerLevel} other={other} />}
        <Collapsible title="Government">
          {loaded(state, (d) => <GovernmentSection government={d.government} />)}
        </Collapsible>
        <Collapsible title="Population">
          {loaded(state, (d) => <PopulationSection population={d.population} other={other} />)}
        </Collapsible>
        <Collapsible title="Economy">
          {loaded(state, (d) => <EconomySection economy={d.economy} other={other} />)}
        </Collapsible>
        <Collapsible title="Resources">
          {loaded(state, (d) => <ResourcesSection resources={d.resources} other={other} />)}
        </Collapsible>
        <Collapsible title="Agriculture">
          {loaded(state, (d) => <AgricultureSection agriculture={d.agriculture} other={other} />)}
        </Collapsible>
        <Collapsible title="Power generation">
          {loaded(state, (d) => <PowerSection power={d.power} other={other} />)}
        </Collapsible>
      </div>
    </aside>
  );
}
