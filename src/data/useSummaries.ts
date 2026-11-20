// Loads public/data/summary.json (one row per country). Used by the list view, and by anything
// that needs every country's headline numbers at once (e.g. coloring the map by Power Level).

import { useEffect, useState } from "react";
import type { CountrySummary } from "./countryData";

export function useSummaries(): CountrySummary[] | null {
  const [rows, setRows] = useState<CountrySummary[] | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/summary.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`summary.json: HTTP ${response.status}`);
        }
        return response.json() as Promise<CountrySummary[]>;
      })
      .then(setRows);
  }, []);
  return rows;
}
