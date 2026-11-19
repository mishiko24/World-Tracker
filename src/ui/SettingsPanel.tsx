// Left sidebar: map look and camera feel.

import { MAP_TYPES, getMapType, type MapType } from "../map/mapTypes";
import { DEFAULT_SETTINGS, type CountryState, type MapStyle, type Settings, type StateStyle } from "../settings";
import { Collapsible } from "./Collapsible";
import { ColorField, Slider } from "./controls";
import { formatPercent, formatPixels } from "./format";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  open: boolean; // owned by App, because the list view makes room for the panel
  onOpenChange: (open: boolean) => void;
}

const STATE_TITLES: Record<CountryState, string> = {
  default: "Default country",
  highlighted: "Highlighted country",
  selected: "Selected country",
};

export function SettingsPanel({ settings, onChange, open, onOpenChange }: SettingsPanelProps) {
  // Style edits always go to the map type currently shown.
  const mapStyle = settings.styles[settings.mapType];
  function updateMapStyle(next: MapStyle) {
    onChange({ ...settings, styles: { ...settings.styles, [settings.mapType]: next } });
  }

  if (!open) {
    return (
      <button className="panel-toggle" onClick={() => onOpenChange(true)} title="Show settings">
        ☰
      </button>
    );
  }

  const states: CountryState[] = ["default", "highlighted", "selected"];

  return (
    <aside className="panel panel-left">
      <header className="panel-header">
        <h2>Settings</h2>
        <button className="icon-button" onClick={() => onOpenChange(false)} title="Hide settings">
          ✕
        </button>
      </header>

      <label className="map-type">
        <span>Map type</span>
        <select
          value={settings.mapType}
          onChange={(e) => onChange({ ...settings, mapType: e.target.value as MapType })}
        >
          {MAP_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="map-type list-view-toggle">
        <span>List view</span>
        <input
          type="checkbox"
          checked={settings.listView}
          onChange={(e) => onChange({ ...settings, listView: e.target.checked })}
        />
      </label>

      <div className="panel-scroll">
        <div className="panel-subtitle">{getMapType(settings.mapType).label} map colors</div>
        {states.map((state) => (
          <Collapsible key={state} title={STATE_TITLES[state]}>
            <StateStyleControls
              style={mapStyle[state]}
              onChange={(style) => updateMapStyle({ ...mapStyle, [state]: style })}
            />
          </Collapsible>
        ))}

        <Collapsible title="Ocean">
          <ColorField
            label="Ocean color"
            value={mapStyle.oceanColor}
            onChange={(oceanColor) => updateMapStyle({ ...mapStyle, oceanColor })}
          />
        </Collapsible>

        <div className="panel-subtitle">Camera</div>

        <Collapsible title="Zoom">
          <Slider
            label="Zoom amount"
            value={settings.zoomAmount}
            min={0.05}
            max={1}
            step={0.05}
            format={formatPercent}
            onChange={(zoomAmount) => onChange({ ...settings, zoomAmount })}
          />
          <Slider
            label="Zoom smoothness"
            value={settings.zoomSmoothness}
            min={0}
            max={1}
            step={0.05}
            format={formatPercent}
            onChange={(zoomSmoothness) => onChange({ ...settings, zoomSmoothness })}
          />
        </Collapsible>

        <button className="reset-button" onClick={() => onChange(DEFAULT_SETTINGS)}>
          Reset all settings
        </button>
      </div>
    </aside>
  );
}

interface StateStyleControlsProps {
  style: StateStyle;
  onChange: (style: StateStyle) => void;
}

function StateStyleControls({ style, onChange }: StateStyleControlsProps) {
  return (
    <>
      <ColorField label="Fill color" value={style.fillColor} onChange={(fillColor) => onChange({ ...style, fillColor })} />
      <Slider
        label="Fill opacity"
        value={style.fillOpacity}
        min={0}
        max={1}
        step={0.05}
        format={formatPercent}
        onChange={(fillOpacity) => onChange({ ...style, fillOpacity })}
      />
      <ColorField
        label="Outline color"
        value={style.outlineColor}
        onChange={(outlineColor) => onChange({ ...style, outlineColor })}
      />
      <Slider
        label="Outline opacity"
        value={style.outlineOpacity}
        min={0}
        max={1}
        step={0.05}
        format={formatPercent}
        onChange={(outlineOpacity) => onChange({ ...style, outlineOpacity })}
      />
      <Slider
        label="Outline thickness"
        value={style.outlineWidth}
        min={0}
        max={5}
        step={0.1}
        format={formatPixels}
        onChange={(outlineWidth) => onChange({ ...style, outlineWidth })}
      />
    </>
  );
}
