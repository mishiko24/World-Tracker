// FAOSTAT crops and livestock production (CC BY 4.0, no key), from the bulk download.
// The unzipped CSV is ~545 MB, so it is streamed line by line through `unzip -p` (present on GitHub runners).
// Countries are matched by UN M49 code (Natural Earth ISO_N3).

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { numericCodeMatcher } from "../lib/countries.ts";
import { parseCsvLine } from "../lib/csv.ts";
import { fetchBytes, lastFullYear, writeCache } from "../lib/io.ts";

const ZIP_URL = "https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip";
const CSV_NAME = "Production_Crops_Livestock_E_All_Data_(Normalized).csv";
const ZIP_PATH = "/tmp/faostat-production.zip";

const PRODUCTION_ELEMENT = "5510"; // "Production", in tonnes
const WORLD_AREA = "5000";
const FIRST_AGGREGATE_AREA = 5000; // area codes >= 5000 are regions/world
const CHINA_AGGREGATE_AREA = "351"; // "China" = mainland + Hong Kong + Macao + Taiwan; would double count
const AGGREGATE_ITEMS = { min: 1700, max: 1999 }; // "Cereals, primary", "Meat, total", ...
const YEARS_KEPT = 3;
const LARGEST_COUNT = 8;
const LEADING_COUNT = 8;
const LEADING_MAX_RANK = 10;

export interface FaoCrop {
  name: string;
  tonnes: number;
  worldRank: number;
  worldShare: number;
}

export interface FaoEntry {
  year: number;
  largest: FaoCrop[];
  worldLeading: FaoCrop[];
}

function cleanItemName(name: string): string {
  return name.replace(/, fresh or chilled$/i, "").replace(/\s+/g, " ").trim();
}

export async function fetchFaostat(): Promise<void> {
  writeFileSync(ZIP_PATH, await fetchBytes(ZIP_URL, "FAOSTAT production zip"));

  // values[year][itemCode] = Map(areaCode -> tonnes)
  const values = new Map<number, Map<string, Map<string, number>>>();
  const itemNames = new Map<string, string>();
  const areaM49 = new Map<string, string>(); // FAO area code -> M49
  const minYear = lastFullYear() - YEARS_KEPT;

  const unzip = spawn("unzip", ["-p", ZIP_PATH, CSV_NAME]);
  let column: Record<string, number> | null = null;
  for await (const line of createInterface({ input: unzip.stdout })) {
    const fields = parseCsvLine(line);
    if (column === null) {
      column = Object.fromEntries(fields.map((name, i) => [name, i]));
      continue;
    }
    const element = fields[column["Element Code"]];
    const year = Number(fields[column.Year]);
    const itemCode = fields[column["Item Code"]];
    const value = fields[column.Value];
    if (element !== PRODUCTION_ELEMENT || fields[column.Unit] !== "t" || year < minYear || value === "") {
      continue;
    }
    if (Number(itemCode) >= AGGREGATE_ITEMS.min && Number(itemCode) <= AGGREGATE_ITEMS.max) {
      continue;
    }
    const area = fields[column["Area Code"]];
    areaM49.set(area, fields[column["Area Code (M49)"]].replace(/^'/, ""));
    itemNames.set(itemCode, cleanItemName(fields[column.Item]));
    if (!values.has(year)) {
      values.set(year, new Map());
    }
    const byItem = values.get(year)!;
    if (!byItem.has(itemCode)) {
      byItem.set(itemCode, new Map());
    }
    byItem.get(itemCode)!.set(area, Number(value));
  }

  // Latest year that has world totals.
  const year = Math.max(...[...values.keys()].filter((y) => [...values.get(y)!.values()].some((m) => m.has(WORLD_AREA))));
  const byItem = values.get(year)!;
  console.log(`  year ${year}, ${byItem.size} items`);

  // Crops per FAO area at that year, with world rank and share.
  const cropsByArea = new Map<string, FaoCrop[]>();
  for (const [itemCode, byArea] of byItem) {
    const world = byArea.get(WORLD_AREA);
    if (world === undefined || world <= 0) {
      continue;
    }
    const producers = [...byArea.entries()].filter(
      ([area, tonnes]) => Number(area) < FIRST_AGGREGATE_AREA && area !== CHINA_AGGREGATE_AREA && tonnes > 0,
    );
    for (const [area, tonnes] of producers) {
      const crop: FaoCrop = {
        name: itemNames.get(itemCode)!,
        tonnes,
        worldRank: 1 + producers.filter(([, other]) => other > tonnes).length,
        worldShare: tonnes / world,
      };
      cropsByArea.set(area, [...(cropsByArea.get(area) ?? []), crop]);
    }
  }

  const ourIdByM49 = numericCodeMatcher();
  const byCountry: Record<string, FaoEntry> = {};
  for (const [area, crops] of cropsByArea) {
    const id = ourIdByM49.get(areaM49.get(area)!);
    if (id === undefined) {
      continue;
    }
    const largest = [...crops].sort((a, b) => b.tonnes - a.tonnes).slice(0, LARGEST_COUNT);
    const worldLeading = crops
      .filter((c) => c.worldRank <= LEADING_MAX_RANK)
      .sort((a, b) => a.worldRank - b.worldRank || b.worldShare - a.worldShare)
      .slice(0, LEADING_COUNT);
    byCountry[id] = { year, largest, worldLeading };
  }

  writeCache("faostat", byCountry);
}
