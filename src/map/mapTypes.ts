// The map types in the left sidebar dropdown.
// Colors per map type live in settings.ts; this file only says what each type draws underneath the countries.

import type { TileSource } from "./TileLayer";

export type MapType = "dark" | "light" | "satellite";

export interface MapTypeInfo {
  id: MapType;
  label: string;
  tiles: TileSource | null; // null = plain ocean color, no imagery
}

// NASA GIBS Blue Marble with shaded relief and ocean depth. Public domain, no API key.
// Detail stops at tile level 8 (~600 m per pixel), so it gets soft when zoomed in far.
// To swap in sharper imagery later, add another TileSource here.
const NASA_BLUE_MARBLE: TileSource = {
  url: (z, x, y) =>
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`,
  maxZoom: 8,
  attribution: "Imagery: NASA Earth Observatory Blue Marble, via NASA GIBS",
};

export const MAP_TYPES: MapTypeInfo[] = [
  { id: "dark", label: "Dark", tiles: null },
  { id: "light", label: "Light", tiles: null },
  { id: "satellite", label: "Satellite (terrain)", tiles: NASA_BLUE_MARBLE },
];

export function getMapType(id: MapType): MapTypeInfo {
  return MAP_TYPES.find((t) => t.id === id)!;
}
