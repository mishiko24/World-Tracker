// React wrapper around MapView. React owns settings and selection; MapView owns the canvas.

import { useEffect, useRef } from "react";
import type { Country } from "../map/geo";
import { MapView } from "../map/MapView";
import type { Settings } from "../settings";

interface MapCanvasProps {
  countries: Country[];
  settings: Settings;
  selectedId: string | null;
  comparedId: string | null;
  onSelect: (id: string | null) => void;
  onCompare: (id: string | null) => void;
  hidden: boolean; // list view: kept alive (camera state survives) but invisible and not clickable
}

export function MapCanvas({ countries, settings, selectedId, comparedId, onSelect, onCompare, hidden }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<MapView | null>(null);
  // MapView keeps its callbacks for its whole life; route them through a ref so it always calls the latest ones.
  const callbacks = useRef({ onSelect, onCompare });
  callbacks.current = { onSelect, onCompare };

  // Create the view once per country list. Settings and selection are pushed in by the effects below,
  // so they are intentionally not dependencies here.
  useEffect(() => {
    const view = new MapView(
      canvasRef.current!,
      countries,
      settings,
      (id) => callbacks.current.onSelect(id),
      (id) => callbacks.current.onCompare(id),
    );
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

  useEffect(() => {
    viewRef.current!.setCompared(comparedId);
  }, [comparedId]);

  return <canvas ref={canvasRef} className={hidden ? "map-canvas map-hidden" : "map-canvas"} />;
}
