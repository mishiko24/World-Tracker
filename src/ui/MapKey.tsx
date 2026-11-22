// "Color countries by" mode (bottom of the map): what the colors mean. Title, color scale with the lowest,
// median and highest values, the top 10 (click one to select it), the source, and "Share map" (MapShareDialog).

import { useState } from "react";
import { valueWithUnit } from "../data/rankings";
import type { ColorScale } from "../map/colorBy";
import type { Country } from "../map/geo";
import { heatGradientCss } from "../map/heatColors";
import type { MapType } from "../map/mapTypes";
import { Flag } from "./Flag";
import { MapShareDialog } from "./MapShareDialog";

interface MapKeyProps {
  scale: ColorScale;
  mapType: MapType;
  countries: Country[];
  onSelect: (id: string) => void;
  onClose: () => void; // back to the map style's colors
}

export function MapKey({ scale, mapType, countries, onSelect, onClose }: MapKeyProps) {
  const [topOpen, setTopOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const value = (v: number) => valueWithUnit(scale.column, v);
  return (
    <div className="map-key">
      <div className="map-key-head">
        <span className="map-key-title">{scale.column.fullLabel}</span>
        <button className="icon-button small" onClick={onClose} title="Back to map colors">
          ✕
        </button>
      </div>
      <span className="map-key-bar" style={{ background: heatGradientCss(mapType) }} />
      <span className="map-key-ends">
        <span>{value(scale.min)}</span>
        <span>median {value(scale.median)}</span>
        <span>{value(scale.max)}</span>
      </span>
      {topOpen && (
        <ol className="map-key-top">
          {scale.ranked.slice(0, 10).map((r) => (
            <li key={r.id}>
              <button onClick={() => onSelect(r.id)}>
                <Flag id={r.id} />
                <span className="map-key-name">{r.name}</span>
                <span className="map-key-value">{value(r.value)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="map-key-foot">
        <button className="link-button" onClick={() => setTopOpen(!topOpen)}>
          {topOpen ? "Hide top 10" : "Top 10"}
        </button>
        <span className="map-key-source">{scale.ranked.length} countries · {scale.group.sources}</span>
        <button className="secondary-button small" onClick={() => setSharing(true)}>
          Share map
        </button>
      </div>
      {sharing && <MapShareDialog scale={scale} countries={countries} onClose={() => setSharing(false)} />}
    </div>
  );
}
