// Data audit: compares the freshly built data with an earlier version and prints a Markdown report of anything
// that looks wrong. Run by the data workflow after every refresh (report lands in the run's summary page), and
// read by the monthly audit scheduled task, which checks flagged values against the sources.
//
//   node scripts/data/audit.ts <git ref>      e.g. HEAD (= last committed data, before this refresh is committed)
//
// Never fails the build: a flagged value may be a real change (a census, a currency crash). A human or Claude
// decides. Checks:
//   - data age: meta.json builtAt older than STALE_DAYS (the refresh didn't run or didn't commit)
//   - coverage: how many countries have each field, now vs before; drops over COVERAGE_DROP flagged
//   - lost countries: had a value before, none now
//   - implausible values: outside PLAUSIBLE ranges
//   - jumps: change between versions beyond JUMPS (relative or absolute per field)
//   - Power Level: top-10 changes and countries moving more than RANK_MOVE places

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { CountrySummary, DataMeta } from "../../src/data/countryData.ts";

const STALE_DAYS = 40;
const COVERAGE_DROP = 0.05; // 5% fewer countries with a field
const RANK_MOVE = 15;
const MAX_LISTED = 15; // per section, biggest first

type Field = Exclude<keyof CountrySummary, "id" | "name">;

const FIELDS: Field[] = [
  "powerLevel", "population", "fertility", "lifeExpectancy", "medianAge", "density", "gdp", "gdpPerCapita",
  "gdpPerCapitaPpp", "growth", "inflation", "debtUsd", "debtPercent", "politicalStability", "electricityTwh", "electricityAccess",
];

// Values outside these are almost certainly a unit or parsing error.
const PLAUSIBLE: Partial<Record<Field, [number, number]>> = {
  fertility: [0.5, 8],
  lifeExpectancy: [40, 90],
  medianAge: [12, 60],
  growth: [-40, 40],
  inflation: [-20, 400],
  debtPercent: [0, 300],
  politicalStability: [0, 100],
  electricityAccess: [0, 100],
  gdpPerCapita: [100, 300_000],
};

// How much a field may move between two monthly refreshes before it's worth a look.
// relative: share of the old value; absolute: in the field's own units.
const JUMPS: Partial<Record<Field, { relative?: number; absolute?: number }>> = {
  population: { relative: 0.08 },
  gdp: { relative: 0.35 },
  gdpPerCapita: { relative: 0.35 },
  lifeExpectancy: { absolute: 3 },
  fertility: { absolute: 0.5 },
  medianAge: { absolute: 3 },
  electricityTwh: { relative: 0.3 },
  powerLevel: { absolute: 8 },
};

interface Snapshot {
  meta: DataMeta;
  summary: Map<string, CountrySummary>;
}

// A field added after the older version was built is missing there: count it as no data, not as present.
function snapshot(metaJson: string, summaryJson: string): Snapshot {
  const rows = JSON.parse(summaryJson) as CountrySummary[];
  const filled = rows.map((row) => ({ ...row, ...Object.fromEntries(FIELDS.map((f) => [f, row[f] ?? null])) }) as CountrySummary);
  return { meta: JSON.parse(metaJson) as DataMeta, summary: new Map(filled.map((row) => [row.id, row])) };
}

function current(): Snapshot {
  return snapshot(readFileSync("public/data/meta.json", "utf8"), readFileSync("public/data/summary.json", "utf8"));
}

function atRef(ref: string): Snapshot {
  const show = (path: string) => execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return snapshot(show("public/data/meta.json"), show("public/data/summary.json"));
}

function number(v: number): string {
  return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : String(Math.round(v * 100) / 100);
}

function main(): void {
  const ref = process.argv[2];
  if (ref === undefined) {
    throw new Error("Usage: node scripts/data/audit.ts <git ref to compare against>");
  }
  const now = current();
  const before = atRef(ref);
  const lines: string[] = [`## Data audit: ${now.meta.builtAt} vs ${before.meta.builtAt} (${ref})`, ""];
  let flags = 0;
  function section(title: string, items: string[]) {
    if (items.length === 0) {
      return;
    }
    flags += items.length;
    lines.push(`### ${title} (${items.length})`, ...items.slice(0, MAX_LISTED).map((i) => `- ${i}`));
    if (items.length > MAX_LISTED) {
      lines.push(`- …and ${items.length - MAX_LISTED} more`);
    }
    lines.push("");
  }

  const ageDays = (Date.now() - Date.parse(`${now.meta.builtAt}T00:00:00Z`)) / 86_400_000;
  section("Stale data", ageDays > STALE_DAYS ? [`built ${Math.floor(ageDays)} days ago: the monthly refresh didn't run or didn't commit`] : []);

  const coverage: string[] = [];
  for (const field of FIELDS) {
    const count = (s: Snapshot) => [...s.summary.values()].filter((c) => c[field] !== null).length;
    const [n, b] = [count(now), count(before)];
    if (b > 0 && (b - n) / b > COVERAGE_DROP) {
      coverage.push(`${field}: ${b} → ${n} countries`);
    }
  }
  section("Coverage drops", coverage);

  const lost: string[] = [];
  const implausible: string[] = [];
  const jumps: { text: string; size: number }[] = [];
  for (const [id, c] of now.summary) {
    const old = before.summary.get(id);
    for (const field of FIELDS) {
      const v = c[field];
      const o = old?.[field] ?? null;
      if (v === null) {
        if (o !== null) {
          lost.push(`${c.name}: ${field} (was ${number(o)})`);
        }
        continue;
      }
      const range = PLAUSIBLE[field];
      if (range !== undefined && (v < range[0] || v > range[1])) {
        implausible.push(`${c.name}: ${field} = ${number(v)} (expected ${range[0]}–${range[1]})`);
      }
      const rule = JUMPS[field];
      if (rule !== undefined && o !== null && o !== 0) {
        const relative = Math.abs(v - o) / Math.abs(o);
        const absolute = Math.abs(v - o);
        const size = rule.relative !== undefined ? relative / rule.relative : absolute / rule.absolute!;
        if (size > 1) {
          jumps.push({ text: `${c.name}: ${field} ${number(o)} → ${number(v)}`, size });
        }
      }
    }
  }
  section("Lost values", lost);
  section("Implausible values", implausible);
  section(
    "Big changes since last time",
    jumps.sort((a, b) => b.size - a.size).map((j) => j.text),
  );

  const ranked = (s: Snapshot) =>
    [...s.summary.values()].filter((c) => c.powerLevel !== null).sort((a, b) => b.powerLevel! - a.powerLevel!).map((c) => c.id);
  const [rankNow, rankBefore] = [ranked(now), ranked(before)];
  const name = (id: string) => now.summary.get(id)?.name ?? before.summary.get(id)!.name;
  const topChanged = rankNow.slice(0, 10).join() !== rankBefore.slice(0, 10).join();
  const movers = rankNow
    .map((id, i) => ({ id, move: rankBefore.includes(id) ? rankBefore.indexOf(id) - i : 0 }))
    .filter((m) => Math.abs(m.move) > RANK_MOVE)
    .map((m) => `${name(m.id)}: ${m.move > 0 ? "up" : "down"} ${Math.abs(m.move)} places`);
  section(
    "Power Level ranking",
    [
      ...(topChanged ? [`top 10 changed: ${rankBefore.slice(0, 10).map(name).join(", ")} → ${rankNow.slice(0, 10).map(name).join(", ")}`] : []),
      ...movers,
    ],
  );

  lines.splice(1, 0, flags === 0 ? "Nothing flagged." : `${flags} item(s) flagged. Flagged ≠ wrong: check against the source.`);
  console.log(lines.join("\n"));
}

main();
