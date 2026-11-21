import { useEffect, useMemo, useState } from "react";
import { useSummaries } from "./data/useSummaries";
import { loadCountries, type Country } from "./map/geo";
import { heatColor } from "./map/heatColors";
import { getMapType } from "./map/mapTypes";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { InfoPanel } from "./ui/info/InfoPanel";
import { CountryList } from "./ui/list/CountryList";
import { DEFAULT_SORT, type Sort } from "./ui/list/sort";
import { MapCanvas } from "./ui/MapCanvas";
import { HeatLegend } from "./ui/HeatLegend";
import { ModeSwitch } from "./ui/ModeSwitch";
import { SearchBox } from "./ui/SearchBox";
import { SettingsPanel } from "./ui/SettingsPanel";
import { isCompactNow } from "./ui/useMobile";
import { readUrlState, writeUrlState } from "./urlState";

// Selection rules (map and list view):
//   left click a country  -> it becomes the selected country A; any comparison ends
//   left click ocean / Esc -> nothing selected, no comparison
//   right click a country  -> compare it (B) with A; ignored when nothing is selected or it is A itself
//   right click ocean      -> comparison ends, A stays selected
//   "Compare" button in the info panel -> picking mode: the next left click / tap on a country compares it
//                                         instead of selecting it (touch screens have no right click)
// On touch screens a long press is a right click (see MapView).
// Selection, comparison, view and list sort are mirrored in the URL (urlState.ts) so any screen can be shared.
export function App() {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comparedId, setComparedId] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [settingsOpen, setSettingsOpen] = useState(() => !isCompactNow()); // on phones settings cover the screen
  const [picking, setPicking] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string; seq: number } | null>(null);
  const summaries = useSummaries();

  // Power Level heat map: countries colored from the lowest to the highest score on the map.
  const fillOverrides = useMemo(() => {
    if (settings.colorBy !== "powerLevel" || summaries === null) {
      return null;
    }
    const scored = summaries.filter((s) => s.powerLevel !== null);
    const min = Math.min(...scored.map((s) => s.powerLevel!));
    const max = Math.max(...scored.map((s) => s.powerLevel!));
    return new Map(scored.map((s) => [s.id, heatColor(settings.mapType, (s.powerLevel! - min) / (max - min))]));
  }, [settings.colorBy, settings.mapType, summaries]);

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
        setPicking(false);
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

  function clearSelection() {
    setSelectedId(null);
    setComparedId(null);
    setPicking(false);
  }

  function select(id: string | null) {
    if (picking) {
      setPicking(false);
      compare(id ?? selectedId!); // ocean (or A itself) just cancels picking
      return;
    }
    setPicking(false);
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
        fillOverrides={fillOverrides}
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
      <div className="top-bar">
        <ModeSwitch active="map" />
        {!settings.listView && <SearchBox countries={countries} onPick={pickFromSearch} />}
      </div>
      <SettingsPanel settings={settings} onChange={changeSettings} open={settingsOpen} onOpenChange={setSettingsOpen} />
      {selectedCountry && (
        <InfoPanel
          country={selectedCountry}
          compared={comparedCountry}
          onClose={clearSelection}
          onEndComparison={() => setComparedId(null)}
          picking={picking}
          onPickingChange={setPicking}
          colors={{
            a: settings.styles[settings.mapType].selected.fillColor,
            b: settings.styles[settings.mapType].compared.fillColor,
          }}
        />
      )}
      {picking && selectedCountry && (
        <div className="pick-banner">
          Pick a country to compare with {selectedCountry.name}
          <button className="icon-button small" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      )}
      {tiles && !settings.listView && <div className="attribution">{tiles.attribution}</div>}
      {fillOverrides && !settings.listView && <HeatLegend mapType={settings.mapType} label="Power Level" />}
    </div>
  );
}
