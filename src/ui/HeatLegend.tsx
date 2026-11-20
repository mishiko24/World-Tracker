// Legend for heat-map coloring (bottom left): gradient from lowest to highest on the map.

import { heatGradientCss } from "../map/heatColors";
import type { MapType } from "../map/mapTypes";

export function HeatLegend({ mapType, label }: { mapType: MapType; label: string }) {
  return (
    <div className="heat-legend">
      <span className="heat-legend-label">{label}</span>
      <span className="heat-legend-bar" style={{ background: heatGradientCss(mapType) }} />
      <span className="heat-legend-ends">
        <span>lowest</span>
        <span>highest</span>
      </span>
    </div>
  );
}
