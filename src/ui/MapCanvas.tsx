// React wrapper around MapView. React owns settings and selection; MapView owns the canvas.

import { useEffect, useRef } from "react";
import type { Country } from "../map/geo";
import { MapView } from "../map/MapView";
import type { Settings } from "../settings";

interface MapCanvasProps {
  countries: Country[];
  settings: Settings;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function MapCanvas({ countries, settings, selectedId, onSelect }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<MapView | null>(null);

  // Create the view once per country list. Settings and selection are pushed in by the effects below,
  // so they are intentionally not dependencies here.
  useEffect(() => {
    const view = new MapView(canvasRef.current!, countries, settings, onSelect);
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [countries]);

  useEffect(() => {
    viewRef.current!.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    viewRef.current!.setSelected(selectedId);
  }, [selectedId]);

  return <canvas ref={canvasRef} className="map-canvas" />;
}
