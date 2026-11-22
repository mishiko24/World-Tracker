// "Color countries by" mode: the hovered country's name and value next to the pointer (mouse only; on touch
// screens a tap opens the info panel instead). Follows the pointer itself, so App only re-renders when the
// hovered country changes.

import { useEffect, useState } from "react";
import { valueWithUnit } from "../data/rankings";
import type { ColorScale } from "../map/colorBy";
import type { Country } from "../map/geo";
import { Flag } from "./Flag";

export function MapTooltip({ scale, hoveredId, countries }: { scale: ColorScale; hoveredId: string | null; countries: Country[] }) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    function move(e: PointerEvent) {
      setPosition(e.pointerType === "mouse" ? { x: e.clientX, y: e.clientY } : null);
    }
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  if (hoveredId === null || position === null) {
    return null;
  }
  const index = scale.ranked.findIndex((r) => r.id === hoveredId);
  const row = scale.ranked[index];
  return (
    <div className="map-tooltip" style={{ left: position.x + 14, top: position.y + 14 }}>
      <Flag id={hoveredId} />
      <span>{countries.find((c) => c.id === hoveredId)!.name}</span>
      {row === undefined ? (
        <span className="no-data">No data</span>
      ) : (
        <>
          <strong>{valueWithUnit(scale.column, row.value)}</strong>
          <span className="map-tooltip-rank">#{index + 1}</span>
        </>
      )}
    </div>
  );
}
