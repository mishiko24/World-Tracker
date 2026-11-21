// Loads public/data/meta.json: when the data was built, and which resources get list columns.

import { useEffect, useState } from "react";
import type { DataMeta } from "./countryData";

export function useDataMeta(): DataMeta | null {
  const [meta, setMeta] = useState<DataMeta | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/meta.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`meta.json: HTTP ${response.status}`);
        }
        return response.json() as Promise<DataMeta>;
      })
      .then(setMeta);
  }, []);
  return meta;
}
