import { useEffect, useState } from "react";
import { loadCountries, type Country } from "./map/geo";
import { getMapType } from "./map/mapTypes";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { InfoPanel } from "./ui/info/InfoPanel";
import { CountryList } from "./ui/list/CountryList";
import { MapCanvas } from "./ui/MapCanvas";
import { SettingsPanel } from "./ui/SettingsPanel";

// Selection rules (map and list view):
//   left click a country  -> it becomes the selected country A; any comparison ends
//   left click ocean / Esc -> nothing selected, no comparison
//   right click a country  -> compare it (B) with A; ignored when nothing is selected or it is A itself
//   right click ocean      -> comparison ends, A stays selected
export function App() {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comparedId, setComparedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    loadCountries().then(setCountries);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedId(null);
        setComparedId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function changeSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  function select(id: string | null) {
    setSelectedId(id);
    setComparedId(null);
  }

  function compare(id: string | null) {
    if (id === null) {
      setComparedId(null);
    } else if (selectedId !== null && id !== selectedId) {
      setComparedId(id);
    }
  }

  if (countries === null) {
    return <div className="loading">Loading map…</div>;
  }

  const selectedCountry = countries.find((c) => c.id === selectedId);
  const comparedCountry = countries.find((c) => c.id === comparedId) ?? null;
  const tiles = getMapType(settings.mapType).tiles;

  return (
    <div className="app">
      <MapCanvas
        countries={countries}
        settings={settings}
        selectedId={selectedId}
        comparedId={comparedId}
        onSelect={select}
        onCompare={compare}
        hidden={settings.listView}
      />
      {settings.listView && (
        <CountryList
          selectedId={selectedId}
          comparedId={comparedId}
          onSelect={select}
          onCompare={compare}
          leftPanelOpen={settingsOpen}
          rightPanelOpen={selectedCountry !== undefined}
        />
      )}
      <SettingsPanel settings={settings} onChange={changeSettings} open={settingsOpen} onOpenChange={setSettingsOpen} />
      {selectedCountry && (
        <InfoPanel
          country={selectedCountry}
          compared={comparedCountry}
          onClose={() => select(null)}
          onEndComparison={() => setComparedId(null)}
        />
      )}
      {tiles && !settings.listView && <div className="attribution">{tiles.attribution}</div>}
    </div>
  );
}
