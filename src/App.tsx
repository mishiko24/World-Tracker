import { useEffect, useState } from "react";
import { loadCountries, type Country } from "./map/geo";
import { getMapType } from "./map/mapTypes";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { InfoPanel } from "./ui/info/InfoPanel";
import { CountryList } from "./ui/list/CountryList";
import { MapCanvas } from "./ui/MapCanvas";
import { SettingsPanel } from "./ui/SettingsPanel";

export function App() {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);

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
      <MapCanvas
        countries={countries}
        settings={settings}
        selectedId={selectedId}
        onSelect={setSelectedId}
        hidden={settings.listView}
      />
      {settings.listView && (
        <CountryList
          selectedId={selectedId}
          onSelect={setSelectedId}
          leftPanelOpen={settingsOpen}
          rightPanelOpen={selectedCountry !== undefined}
        />
      )}
      <SettingsPanel settings={settings} onChange={changeSettings} open={settingsOpen} onOpenChange={setSettingsOpen} />
      {selectedCountry && <InfoPanel country={selectedCountry} onClose={() => setSelectedId(null)} />}
      {tiles && !settings.listView && <div className="attribution">{tiles.attribution}</div>}
    </div>
  );
}
