// Entry point for the data pipeline.
//
//   node scripts/data/run.ts                 all fetchers, then build
//   node scripts/data/run.ts imf build       only these steps, in the order given
//
// Fetchers write data-cache/<source>.json; build turns the caches into public/data/countries/*.json.

import { fetchEia } from "./fetch/eia.ts";
import { fetchEnergy } from "./fetch/energy.ts";
import { fetchFactbook } from "./fetch/factbook.ts";
import { fetchFaostat } from "./fetch/faostat.ts";
import { fetchImf } from "./fetch/imf.ts";
import { fetchUnWpp } from "./fetch/unwpp.ts";
import { fetchUsgs } from "./fetch/usgs.ts";
import { fetchWikidata } from "./fetch/wikidata.ts";
import { fetchWorldBank } from "./fetch/worldbank.ts";

// Order matters: factbook reads the wikidata cache.
const STEPS: Record<string, () => Promise<void>> = {
  worldbank: fetchWorldBank,
  imf: fetchImf,
  wikidata: fetchWikidata,
  factbook: fetchFactbook,
  unwpp: fetchUnWpp,
  energy: fetchEnergy,
  eia: fetchEia,
  usgs: fetchUsgs,
  faostat: fetchFaostat,
  build: async () => {
    await import("./build.ts");
  },
};

// Every step runs even if an earlier one failed, so one run reports all problems.
// The process still exits with an error if anything failed.
const requested = process.argv.slice(2);
const steps = requested.length > 0 ? requested : Object.keys(STEPS);
const failures: string[] = [];
for (const name of steps) {
  const step = STEPS[name];
  if (step === undefined) {
    throw new Error(`Unknown step "${name}". Steps: ${Object.keys(STEPS).join(", ")}`);
  }
  console.log(`[${name}]`);
  const started = Date.now();
  try {
    await step();
    console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  } catch (error) {
    console.error(`  FAILED: ${(error as Error).stack}`);
    failures.push(name);
  }
}
if (failures.length > 0) {
  console.error(`\nFailed steps: ${failures.join(", ")}`);
  process.exitCode = 1;
}
