// User-adjustable settings (left sidebar). Saved to localStorage.
//
// Each map type has its own colors, so tweaking the satellite look doesn't wreck the dark map.
// Zoom settings are shared by all map types.

import type { MapType } from "./map/mapTypes";

export interface StateStyle {
  fillColor: string; // "#rrggbb"
  fillOpacity: number; // 0..1
  outlineColor: string;
  outlineOpacity: number;
  outlineWidth: number; // screen pixels
}

export type CountryState = "default" | "highlighted" | "compared" | "selected";

export interface MapStyle {
  default: StateStyle;
  highlighted: StateStyle;
  compared: StateStyle; // country B in comparison mode (right click)
  selected: StateStyle;
  oceanColor: string; // also the background while satellite tiles load
}

export interface Settings {
  mapType: MapType;
  listView: boolean; // show the sortable country table instead of the map
  listCollapsed: string[]; // list column groups shown as a "+" strip (ColumnGroup ids, src/ui/list/columns.ts)
  colorBy: "style" | "powerLevel"; // country fill: the map style's colors, or a heat map of Power Level
  styles: Record<MapType, MapStyle>;
  zoomAmount: number; // zoom change per scroll notch: 0.3 = 30%
  zoomSmoothness: number; // 0 = instant, 1 = slowest glide
}

const DARK_STYLE: MapStyle = {
  default: { fillColor: "#262a30", fillOpacity: 1, outlineColor: "#4d555f", outlineOpacity: 1, outlineWidth: 0.6 },
  highlighted: { fillColor: "#c9772a", fillOpacity: 1, outlineColor: "#ffd9a8", outlineOpacity: 1, outlineWidth: 1 },
  compared: { fillColor: "#2f7de1", fillOpacity: 1, outlineColor: "#ffffff", outlineOpacity: 1, outlineWidth: 1.5 },
  selected: { fillColor: "#e3261b", fillOpacity: 1, outlineColor: "#ffffff", outlineOpacity: 1, outlineWidth: 1.5 },
  oceanColor: "#0f1419",
};

const LIGHT_STYLE: MapStyle = {
  default: { fillColor: "#f4f2ee", fillOpacity: 1, outlineColor: "#9a9a9a", outlineOpacity: 1, outlineWidth: 0.6 },
  highlighted: { fillColor: "#f0b26b", fillOpacity: 1, outlineColor: "#8a5a20", outlineOpacity: 1, outlineWidth: 1 },
  compared: { fillColor: "#2f7de1", fillOpacity: 1, outlineColor: "#0b2c57", outlineOpacity: 1, outlineWidth: 1.5 },
  selected: { fillColor: "#e3261b", fillOpacity: 1, outlineColor: "#5a0d08", outlineOpacity: 1, outlineWidth: 1.5 },
  oceanColor: "#c9d7e3",
};

// Countries are see-through so the imagery shows; only borders and state tints are drawn.
const SATELLITE_STYLE: MapStyle = {
  default: { fillColor: "#ffffff", fillOpacity: 0, outlineColor: "#ffffff", outlineOpacity: 0.45, outlineWidth: 0.6 },
  highlighted: { fillColor: "#ffffff", fillOpacity: 0.2, outlineColor: "#ffffff", outlineOpacity: 1, outlineWidth: 1.2 },
  compared: { fillColor: "#2f7de1", fillOpacity: 0.3, outlineColor: "#5aa2ff", outlineOpacity: 1, outlineWidth: 2 },
  selected: { fillColor: "#e3261b", fillOpacity: 0.3, outlineColor: "#ff4a3d", outlineOpacity: 1, outlineWidth: 2 },
  oceanColor: "#0b1a2a",
};

export const DEFAULT_SETTINGS: Settings = {
  mapType: "dark",
  listView: false,
  listCollapsed: ["production", "reserves"], // dozens of columns each
  colorBy: "style",
  styles: {
    dark: DARK_STYLE,
    light: LIGHT_STYLE,
    satellite: SATELLITE_STYLE,
  },
  zoomAmount: 0.3,
  zoomSmoothness: 0.5,
};

// Bump the version when the Settings shape changes incompatibly; old saves are then ignored.
const STORAGE_KEY = "worldTracker.settings.v2";

// Saved settings are merged over the defaults, so settings added later get their default value.
export function loadSettings(): Settings {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return DEFAULT_SETTINGS;
  }
  const parsed = JSON.parse(saved) as Partial<Settings>;
  const savedStyles: Partial<Record<MapType, Partial<MapStyle>>> = parsed.styles ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    styles: {
      dark: mergeStyle(DEFAULT_SETTINGS.styles.dark, savedStyles.dark),
      light: mergeStyle(DEFAULT_SETTINGS.styles.light, savedStyles.light),
      satellite: mergeStyle(DEFAULT_SETTINGS.styles.satellite, savedStyles.satellite),
    },
  };
}

function mergeStyle(defaults: MapStyle, saved: Partial<MapStyle> | undefined): MapStyle {
  return {
    ...defaults,
    ...saved,
    default: { ...defaults.default, ...saved?.default },
    highlighted: { ...defaults.highlighted, ...saved?.highlighted },
    compared: { ...defaults.compared, ...saved?.compared },
    selected: { ...defaults.selected, ...saved?.selected },
  };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
