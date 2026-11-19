// Loads public/data/countries/<id>.json for the selected country.
// Files are small (a few KB) and fetched on demand; the browser cache handles repeats.

import { useEffect, useState } from "react";
import type { CountryData } from "../../data/countryData";

export type CountryDataState =
  | { status: "loading" }
  | { status: "loaded"; data: CountryData }
  | { status: "failed"; message: string };

export function useCountryData(id: string): CountryDataState {
  const [state, setState] = useState<{ id: string; result: CountryDataState }>({ id, result: { status: "loading" } });

  useEffect(() => {
    let cancelled = false; // a newer selection may finish first
    fetch(`${import.meta.env.BASE_URL}data/countries/${id}.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<CountryData>;
      })
      .then(
        (data) => {
          if (!cancelled) {
            setState({ id, result: { status: "loaded", data } });
          }
        },
        (error: Error) => {
          console.error(`Failed to load data for ${id}`, error);
          if (!cancelled) {
            setState({ id, result: { status: "failed", message: error.message } });
          }
        },
      );
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Until the effect for a new id resolves, report loading instead of the previous country's data.
  if (state.id !== id) {
    return { status: "loading" };
  }
  return state.result;
}
