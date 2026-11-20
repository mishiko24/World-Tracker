import { useEffect, useState } from "react";
import { useSummaries } from "./data/useSummaries";
import { loadCountries, type Country } from "./map/geo";
import { getMapType } from "./map/mapTypes";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { InfoPanel } from "./ui/info/InfoPanel";
import { CountryList } from "./ui/list/CountryList";
import { DEFAULT_SORT, type Sort } from "./ui/list/sort";
import { MapCanvas } from "./ui/MapCanvas";
import { SearchBox } from "./ui/SearchBox";
import { SettingsPanel } from "./ui/SettingsPanel";
import { readUrlState, writeUrlState } from "./urlState";

// Selection rules (map and list view):
//   left click a country  -> it becomes the selected country A; any comparison ends
//   left click ocean / Esc -> nothing selected, no comparison
//   right click a country  -> compare it (B) with A; ignored when nothing is selected or it is A itself
//   right click ocean      -> comparison ends, A stays selected
// Selection, comparison, view and list sort are mirrored in the URL (urlState.ts) so any screen can be shared.
export function App() {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comparedId, setComparedId] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [focusRequest, setFocusRequest] = useState<{ id: string; seq: number } | null>(null);
  const summaries = useSummaries();

  // Load countries, then apply the state from a shared link.
  useEffect(() => {
    loadCountries().then((loaded) => {
      const url = readUrlState(new Set(loaded.map((c) => c.id)));
      setCountries(loaded);
      setSelectedId(url.selectedId);
      setComparedId(url.comparedId);
      setSort(url.sort);
      if (url.listView !== null) {
        setSettings((s) => ({ ...s, listView: url.listView! })); // not saved: a link shouldn't change your defaults
      }
      if (url.selectedId !== null) {
        setFocusRequest({ id: url.selectedId, seq: 0 });
      }
    });
  }, []);

  useEffect(() => {
    if (countries !== null) {
      writeUrlState({ selectedId, comparedId, listView: settings.listView, sort });
    }
  }, [countries, selectedId, comparedId, settings.listView, sort]);

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

  function pickFromSearch(id: string) {
    select(id);
    setFocusRequest({ id, seq: (focusRequest?.seq ?? 0) + 1 });
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
        focusRequest={focusRequest}
      />
      {settings.listView && (
        <CountryList
          rows={summaries}
          sort={sort}
          onSortChange={setSort}
          selectedId={selectedId}
          comparedId={comparedId}
          onSelect={select}
          onCompare={compare}
          leftPanelOpen={settingsOpen}
          rightPanelOpen={selectedCountry !== undefined}
        />
      )}
      {!settings.listView && <SearchBox countries={countries} onPick={pickFromSearch} />}
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
