import { useEffect, useState } from "react";
import { loadCountries, type Country } from "./map/geo";
import { getMapType } from "./map/mapTypes";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { InfoPanel } from "./ui/info/InfoPanel";
import { MapCanvas } from "./ui/MapCanvas";
import { SettingsPanel } from "./ui/SettingsPanel";

export function App() {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadCountries().then(setCountries);
  }, []);

  function changeSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  if (countries === null) {
    return <div className="loading">Loading map…</div>;
  }

  const selectedCountry = countries.find((c) => c.id === selectedId);
  const tiles = getMapType(settings.mapType).tiles;

  return (
    <div className="app">
      <MapCanvas countries={countries} settings={settings} selectedId={selectedId} onSelect={setSelectedId} />
      <SettingsPanel settings={settings} onChange={changeSettings} />
      {selectedCountry && <InfoPanel country={selectedCountry} onClose={() => setSelectedId(null)} />}
      {tiles && <div className="attribution">{tiles.attribution}</div>}
    </div>
  );
}
