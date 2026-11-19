// Right sidebar: info about the selected country.
// Sections are placeholders until the data phase.

import type { Country } from "../map/geo";
import { Collapsible } from "./Collapsible";

interface InfoPanelProps {
  country: Country;
  onClose: () => void;
}

const SECTIONS = ["Government", "Population", "Economy", "Resources", "Power generation"];

export function InfoPanel({ country, onClose }: InfoPanelProps) {
  return (
    <aside className="panel panel-right">
      <header className="panel-header">
        <div>
          <h2>{country.name}</h2>
          <div className="country-codes">
            {country.iso3 ?? country.id} · {country.wikidata}
          </div>
        </div>
        <button className="icon-button" onClick={onClose} title="Deselect">
          ✕
        </button>
      </header>

      <div className="panel-scroll">
        {SECTIONS.map((title) => (
          <Collapsible key={title} title={title}>
            <p className="placeholder">No data yet.</p>
          </Collapsible>
        ))}
      </div>
    </aside>
  );
}
