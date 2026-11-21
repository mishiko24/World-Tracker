// Right sidebar: info about the selected country, one collapsible section per topic.
// Stays mounted while switching countries, so open sections stay open.
// Comparison mode: when another country is right-clicked (long-pressed, or picked after "Compare"),
// every number also shows that country's value.
// On phones the panel is a bottom sheet (useBottomSheet.ts).

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CountryData } from "../../data/countryData";
import type { Country } from "../../map/geo";
import { Collapsible } from "../Collapsible";
import { AgricultureSection } from "./AgricultureSection";
import { Flag } from "../Flag";
import { compareVariables, type CompareColors } from "./Compare";
import { EconomySection, GovernmentSection, PopulationSection } from "./BasicSections";
import { PowerLevelCard } from "./PowerLevelCard";
import { PowerSection } from "./PowerSection";
import { ResourcesSection } from "./ResourcesSection";
import type { CardSide } from "../../share/shareCard";
import { ShareDialog } from "../ShareDialog";
import { useMobile } from "../useMobile";
import { useBottomSheet } from "./useBottomSheet";
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
  picking: boolean; // waiting for the user to pick the country to compare with
  onPickingChange: (picking: boolean) => void;
  colors: CompareColors; // map colors of the selected and compared states, so the panel matches the map
}

export function InfoPanel(props: InfoPanelProps) {
  const { country, compared, onClose, onEndComparison, picking, onPickingChange, colors } = props;
  const mobile = useMobile();
  const sheet = useBottomSheet(mobile);
  const state = useCountryData(country.id);
  const comparedState = useCountryData(compared?.id ?? null);
  // Comparison numbers appear once the other country's data has loaded.
  const other = comparedState.status === "loaded" ? comparedState.data : null;
  const [sharing, setSharing] = useState(false);

  // Share card inputs. Memoized: the dialog redraws the card whenever these change.
  const cardA = useMemo<CardSide | null>(
    () => (state.status === "loaded" ? { country, data: state.data } : null),
    [country, state],
  );
  const cardB = useMemo<CardSide | null>(
    () => (compared !== null && other !== null ? { country: compared, data: other } : null),
    [compared, other],
  );
  const shareReady = cardA !== null && (compared === null || cardB !== null);

  // Picking happens on the map, so get the sheet out of the way.
  const setSnap = sheet.setSnap;
  useEffect(() => {
    if (picking) {
      setSnap("peek");
    }
  }, [picking, setSnap]);

  return (
    <aside
      className={`panel panel-right ${sheet.className}${compared ? " comparing" : ""}`}
      style={{ ...compareVariables(colors, country.id, compared?.id ?? null), ...sheet.style }}
    >
      <header className="panel-header" {...sheet.handleProps}>
        <div className="sheet-grip" />
        <div className="panel-title">
          {/* In comparison mode the names are underlined in their map colors: this header is the color key. */}
          <h2>
            <Flag id={country.id} size="large" />
            <span className={compared ? "keyed a" : undefined}>{country.name}</span>
          </h2>
          {compared && (
            <div className="compare-header">
              vs <Flag id={compared.id} />
              <span className="keyed b">{compared.name}</span>
              <button className="icon-button small" onClick={onEndComparison} title="End comparison">
                ✕
              </button>
              {comparedState.status === "failed" && <span className="error"> couldn't load: {comparedState.message}</span>}
            </div>
          )}
        </div>
        <div className="panel-header-buttons">
          <button className="share-button" onClick={() => setSharing(true)} disabled={!shareReady} title="Share image and link">
            Share
          </button>
          <button
            className={picking ? "compare-button active" : "compare-button"}
            onClick={() => onPickingChange(!picking)}
            title="Pick a country to compare with (or right-click / long-press it)"
          >
            {picking ? "Picking…" : "Compare"}
          </button>
          <button className="icon-button" onClick={onClose} title="Deselect">
            ✕
          </button>
        </div>
      </header>

      {/* Sections are always rendered (even while loading) so their open/closed state survives country switches. */}
      <div className="panel-scroll">
        {state.status === "loaded" && <PowerLevelCard powerLevel={state.data.powerLevel} other={other} />}
        <Collapsible title="Government">
          {loaded(state, (d) => <GovernmentSection government={d.government} other={other} />)}
        </Collapsible>
        <Collapsible title="Population">
          {loaded(state, (d) => <PopulationSection population={d.population} trends={d.trends} other={other} />)}
        </Collapsible>
        <Collapsible title="Economy">
          {loaded(state, (d) => <EconomySection economy={d.economy} trends={d.trends} other={other} />)}
        </Collapsible>
        <Collapsible title="Resources">
          {loaded(state, (d) => <ResourcesSection resources={d.resources} other={other} />)}
        </Collapsible>
        <Collapsible title="Agriculture">
          {loaded(state, (d) => <AgricultureSection agriculture={d.agriculture} other={other} />)}
        </Collapsible>
        <Collapsible title="Power generation">
          {loaded(state, (d) => <PowerSection power={d.power} trends={d.trends} other={other} />)}
        </Collapsible>
      </div>
      {sharing && cardA !== null && <ShareDialog a={cardA} b={cardB} onClose={() => setSharing(false)} />}
    </aside>
  );
}
