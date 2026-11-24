// Static pages for search engines and link previews, written into dist/ after `vite build` (run by build-site.mjs).
//
//   countries/              hub: every country A-Z and every ranking
//   country/<slug>/         one page per country: its data as plain HTML
//   rank/<slug>/            one page per list-view number column with enough countries: every country ranked
//   map/<slug>/             the same columns as a world map (image cards/map-<slug>.jpg) and the top 20
//   compare/<a>-vs-<b>/     which pairs, and the addresses: src/data/sitePages.ts (neighbours: data/nearby.json)
//   sitemap.xml             all of the above plus the map and the Sources & method page
//   404.html                forwards guessed addresses (compare/usa-vs-russia) to the real page (notFound.ts)
//
// Each page links into the interactive map (?c=ID, ?c=A&vs=B). Data comes from dist/data (copied from public/data).
// Returns the share-card images the pages use as link previews; cards.ts renders them afterwards.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { GeometryCollection, Topology } from "topojson-specification";
import {
  BUDGET_FUNCTIONS,
  PILLAR_LABELS,
  PILLAR_ORDER,
  type CountryData,
  type CountrySummary,
  type DataMeta,
  type NumberFact,
  SOURCES,
} from "../../src/data/countryData";
import { budgetColor, budgetShare } from "../../src/data/budget";
import { TRADE_GROUPS, tradeColor } from "../../src/data/trade";
import { ABOUT_URL, GAME_URL, SITE_URL } from "../../src/links";
import type { CountryProperties } from "../../src/map/geo";
import { barWidths, gap, winner, type Better, type DiffMode } from "../../src/ui/info/Compare";
import { amount, dollars, fullNumber, percent, roundDollars, share, tonnes } from "../../src/ui/info/formatData";
import { POWER_SOURCE_STYLE } from "../../src/ui/info/PowerSection";
import { columnGroups, numberColumns, type NumberColumn } from "../../src/ui/list/columns";
import { colorScale, mappableGroups, type ColorScale, type MappableGroup } from "../../src/map/colorBy";
import { valueWithUnit, worldRanks } from "../../src/data/rankings";
import { changeText, thenNowRows } from "../../src/share/thenNowCard";
import { comparePagePath, countryPagePath, G20, isNearby, slugOf, type Nearby } from "../../src/data/sitePages";
import { escape, inWords, page, rootFrom } from "./html";
import { notFoundPage } from "./notFound";

// Comparison pages exist for every pair that includes one of these (the pairs people search for).
export type CardJob =
  | {
      file: string; // path under dist/, e.g. "cards/fra.jpg"
      a: string; // country id
      b: string | null; // compared country id, null for a single-country card
    }
  | {
      file: string; // "cards/map-<slug>.jpg"
      map: string; // list column id: the world colored by it
    };

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function write(dist: string, path: string, html: string): void {
  mkdirSync(`${dist}/${path}`, { recursive: true });
  writeFileSync(`${dist}/${path}index.html`, html);
}

// Folders this script owns in dist/; emptied first so a rerun leaves no pages from the previous run.
const OUTPUT_FOLDERS = ["countries", "country", "rank", "map", "compare", "cards"];

export function buildPages(dist: string): { cards: CardJob[]; pages: number } {
  for (const folder of OUTPUT_FOLDERS) {
    rmSync(`${dist}/${folder}`, { recursive: true, force: true });
  }
  const meta = readJson<DataMeta>(`${dist}/data/meta.json`);
  const summaries = readJson<CountrySummary[]>(`${dist}/data/summary.json`);
  const countries = summaries.map((s) => readJson<CountryData>(`${dist}/data/countries/${s.id}.json`));
  const byId = new Map(countries.map((d) => [d.id, d]));

  const slugs = new Map<string, string>(); // id -> slug
  for (const d of countries) {
    const slug = slugOf(d.name);
    if ([...slugs.values()].includes(slug)) {
      throw new Error(`Two countries share the page slug "${slug}"`);
    }
    slugs.set(d.id, slug);
  }
  const site: Site = {
    meta,
    byId,
    slugs,
    countries,
    summaries: new Map(summaries.map((x) => [x.id, x])),
    nearby: readJson<Nearby>(`${dist}/data/nearby.json`),
  };

  const cards: CardJob[] = countries.map((d) => ({ file: cardOf(d.id, null), a: d.id, b: null }));
  const paths: string[] = ["", ABOUT_URL, GAME_URL, "countries/"];

  write(dist, "countries/", hubPage(site));
  for (const d of countries) {
    const path = countryPath(site, d.id);
    write(dist, path, countryPage(site, d));
    paths.push(path);
  }
  for (const { group, columns } of rankingGroups(site)) {
    for (const column of columns) {
      const path = `rank/${column.slug}/`;
      write(dist, path, rankPage(site, column, path));
      paths.push(path);
      const mapPath = `map/${column.slug}/`;
      const mapCard = `cards/map-${column.slug}.jpg`;
      cards.push({ file: mapCard, map: column.id });
      write(dist, mapPath, mapPage(site, colorScale(column, group, summaries), mapPath, mapCard));
      paths.push(mapPath);
    }
  }
  for (const [a, b] of comparePairs(site)) {
    const path = comparePath(site, a, b);
    // G20 vs G20 and regional pairs get their own card; a G20 country vs a far-away country uses the G20 one's card.
    const ownCard = (G20.includes(a) && G20.includes(b)) || isNearby(site.nearby, a, b);
    if (ownCard) {
      cards.push({ file: cardOf(a, b), a, b });
    }
    const image = ownCard ? cardOf(a, b) : cardOf(G20.includes(a) ? a : b, null);
    write(dist, path, comparePage(site, byId.get(a)!, byId.get(b)!, path, image));
    paths.push(path);
  }

  writeFileSync(`${dist}/sitemap.xml`, sitemap(paths, meta.builtAt));
  writeFileSync(
    `${dist}/404.html`,
    notFoundPage({ slugs, codes: countryCodes(dist), comparePaths: paths.filter((p) => p.startsWith("compare/")) }),
  );
  // The app's theme first (fonts relative to dist/site.css), then the static pages' own rules.
  const theme = readFileSync("src/theme.css", "utf8").replaceAll("url(/fonts/", "url(fonts/");
  writeFileSync(`${dist}/site.css`, `${theme}\n${readFileSync("scripts/site/site.css", "utf8")}`);
  return { cards, pages: paths.length - 3 };
}

// ---------- paths ----------

interface Site {
  meta: DataMeta;
  byId: Map<string, CountryData>;
  slugs: Map<string, string>;
  countries: CountryData[];
  summaries: Map<string, CountrySummary>; // list-view rows: the values the rankings sort by
  nearby: Nearby;
}

function countryPath(site: Site, id: string): string {
  return countryPagePath(site.byId.get(id)!.name);
}

// Pairs in alphabetical slug order, so "france-vs-germany" exists and "germany-vs-france" doesn't.
function orderPair(site: Site, a: string, b: string): [string, string] {
  return site.slugs.get(a)! < site.slugs.get(b)! ? [a, b] : [b, a];
}

function comparePath(site: Site, a: string, b: string): string {
  return comparePagePath(site.byId.get(a)!.name, site.byId.get(b)!.name);
}

function comparePairs(site: Site): [string, string][] {
  const seen = new Set<string>();
  const pairs: [string, string][] = [];
  function add(a: string, b: string) {
    const pair = orderPair(site, a, b);
    const key = pair.join("-");
    if (a !== b && !seen.has(key)) {
      seen.add(key);
      pairs.push(pair);
    }
  }
  for (const g of G20) {
    for (const d of site.countries) {
      add(g, d.id);
    }
  }
  for (const [id, nearby] of Object.entries(site.nearby)) {
    for (const other of nearby) {
      add(id, other);
    }
  }
  return pairs;
}

// id -> [ISO3, ISO2] from the map geometry, for the 404 page's name lookup.
function countryCodes(dist: string): Map<string, (string | null)[]> {
  const topo = readJson<Topology<{ countries: GeometryCollection<CountryProperties> }>>(`${dist}/data/countries.topo.json`);
  return new Map(
    topo.objects.countries.geometries.map((g) => {
      const p = g.properties as CountryProperties;
      return [p.id, [p.iso3, p.iso2]];
    }),
  );
}


function cardOf(a: string, b: string | null): string {
  return `cards/${a.toLowerCase()}${b === null ? "" : `-vs-${b.toLowerCase()}`}.jpg`;
}

// Flag image (public/flags, built by scripts/build-flags.mjs); decorative, the name is always next to it.
function flag(root: string, id: string): string {
  return `<img class="flag" src="${root}flags/${id}.svg" alt="" width="20" height="15" loading="lazy">`;
}

function countryLink(site: Site, root: string, id: string): string {
  return `${flag(root, id)}<a href="${root}${countryPath(site, id)}">${escape(site.byId.get(id)!.name)}</a>`;
}

// ---------- building blocks ----------

type Row = [label: string, value: string | null];

function table(rows: Row[]): string {
  const shown = rows.filter((r): r is [string, string] => r[1] !== null);
  if (shown.length === 0) {
    return `<p class="no-data">No data.</p>`;
  }
  return `<table class="facts">${shown.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${value}</td></tr>`).join("")}</table>`;
}

// Value with its year in small print.
function withYear(text: string, fact: { year: number }): string {
  return `${escape(text)} <span class="year">${fact.year}</span>`;
}

function num(fact: NumberFact | null, format: (v: number) => string): string | null {
  return fact === null ? null : withYear(format(fact.value), fact);
}

function powerLevelText(d: CountryData): string {
  const p = d.powerLevel;
  return p === null ? "not scored" : `${p.score.toFixed(1)} (#${p.rank} of ${p.of})`;
}

// ---------- pages ----------

function countryPage(site: Site, d: CountryData): string {
  const path = countryPath(site, d.id);
  const root = rootFrom(path);
  const g = d.government;
  const p = d.population;
  const e = d.economy;
  const level = d.powerLevel;

  const facts: string[] = [];
  if (p.total !== null) facts.push(`a population of ${inWords(p.total.value)}`);
  if (e.gdp !== null) facts.push(`a GDP of $${inWords(e.gdp.value)}`);
  const lead =
    (facts.length > 0 ? `${d.name} has ${facts.join(" and ")}. ` : "") +
    (level === null ? "" : `Its Power Level is ${level.score.toFixed(1)} out of 100, #${level.rank} of ${level.of} countries.`);

  const sections: string[] = [];
  sections.push(`<section><h2>Power Level</h2>${
    level === null
      ? `<p class="no-data">Not enough data to score ${escape(d.name)}.</p>`
      : `<p class="score"><strong>${level.score.toFixed(1)}</strong> / 100 · #${level.rank} of ${level.of} countries</p>` +
        table(PILLAR_ORDER.map((pillar) => [PILLAR_LABELS[pillar], level.pillars[pillar] === null ? null : level.pillars[pillar]!.toFixed(0)]))
  }<p class="note">World Tracker’s own index. <a href="${root}${ABOUT_URL}#power-level">How it’s calculated</a></p></section>`);

  // Best world rankings (same as the "World rankings" share card), each linking to its ranking page.
  const ranks = worldRanks(d.id, [...site.summaries.values()], numberColumns(columnGroups(site.meta.resources))).slice(0, 10);
  if (ranks.length > 0) {
    sections.push(
      `<section><h2>World rankings</h2><table class="list ranks"><tbody>${ranks
        .map(
          (r) =>
            `<tr><td class="rank${r.rank <= 3 ? ` medal-${r.rank}` : ""}">#${r.rank}</td><td><a href="${root}rank/${r.column.slug}/">${escape(r.column.fullLabel)}</a> <span class="year">of ${r.of}</span></td><td>${escape(valueWithUnit(r.column, r.value))}</td></tr>`,
        )
        .join("")}</tbody></table><p class="note">${escape(d.name)}’s highest places in the world (ties of more than three countries left out).</p></section>`,
    );
  }

  // Then and now (same as the share card).
  const thenNow = thenNowRows(d);
  if (thenNow.length > 0) {
    sections.push(
      `<section><h2>Then and now</h2><table class="list"><thead><tr><th></th><th>Then</th><th>Now</th><th>Change</th></tr></thead><tbody>${thenNow
        .map(
          (r) =>
            `<tr><td>${escape(r.label)}</td><td>${escape(r.format(r.then))} <span class="year">${r.thenYear}</span></td><td>${escape(r.format(r.now))} <span class="year">${r.nowYear}</span></td><td class="${r.now > r.then ? "up" : r.now < r.then ? "down" : ""}">${escape(changeText(r))}</td></tr>`,
        )
        .join("")}</tbody></table></section>`,
    );
  }

  sections.push(`<section><h2>Government</h2>${table([
    ["Government type", g.type === null ? null : escape(g.type.value)],
    ["Head of state", g.headOfState === null ? null : escape(g.headOfState.value)],
    ["Head of government", g.headOfGovernment === null ? null : escape(g.headOfGovernment.value)],
    ["Ruling party", g.rulingParty === null ? null : escape(g.rulingParty.value)],
    ["Political stability", num(g.politicalStability, (v) => `${v.toFixed(0)} / 100`)],
  ])}</section>`);

  const age = p.ageStructure;
  sections.push(`<section><h2>Population</h2>${table([
    ["Population", num(p.total, fullNumber)],
    ["Density", num(p.density, (v) => `${fullNumber(v)} per km²`)],
    ["Children per woman", num(p.fertility, (v) => v.toFixed(2))],
    ["Life expectancy", num(p.lifeExpectancy, (v) => `${v.toFixed(1)} years`)],
    ["Median age", num(p.medianAge, (v) => `${v.toFixed(1)} years`)],
    ["Age 0–14", age === null ? null : withYear(percent(age.under15, 0), age)],
    ["Age 15–64", age === null ? null : withYear(percent(age.from15to64, 0), age)],
    ["Age 65+", age === null ? null : withYear(percent(age.over65, 0), age)],
  ])}</section>`);

  sections.push(`<section><h2>Economy</h2>${table([
    ["GDP", e.gdp === null ? null : withYear(dollars(e.gdp.value) + (e.gdpRank === null ? "" : ` · #${e.gdpRank.rank} in the world`), e.gdp)],
    ["GDP per person", num(e.gdpPerCapita, dollars)],
    ["GDP per person (PPP)", num(e.gdpPerCapitaPpp, dollars)],
    ["Real growth", num(e.growth, (v) => percent(v))],
    ["Inflation", num(e.inflation, (v) => percent(v))],
    ["Central government debt", e.debt === null ? null : withYear(`${percent(e.debt.value, 0)} of GDP${e.debtUsd === null ? "" : ` (${dollars(e.debtUsd.value)})`}`, e.debt)],
  ])}</section>`);

  const budget = e.budget;
  if (budget !== null) {
    const rows = BUDGET_FUNCTIONS.map((f) => {
      const shareOfBudget = budgetShare(budget, f.id);
      const usd = budget.totalUsd === null ? "" : roundDollars((shareOfBudget / 100) * budget.totalUsd);
      return `<tr><td><span class="swatch" style="background:${budgetColor(f.id)}"></span>${escape(f.label)}</td><td>${percent(shareOfBudget)}</td><td>${usd}</td></tr>`;
    });
    const total = `${budget.totalUsd === null ? "" : `${roundDollars(budget.totalUsd)}, `}${percent(budget.percentOfGdp, 0)} of GDP`;
    sections.push(
      `<section><h2>Government budget</h2><p>What the government spends its money on (all levels of government, ${budget.year}): ${escape(total)}.</p>` +
        `<table class="list"><thead><tr><th>Function</th><th>Share</th><th>Amount</th></tr></thead><tbody>${rows.join("")}</tbody></table>` +
        `<p class="note">${escape(SOURCES[budget.source].name)}.</p></section>`,
    );
  }

  const t = d.trade;
  if (t !== null) {
    const signed = (v: number) => (v < 0 ? `−${dollars(-v)}` : `+${dollars(v)}`);
    const groups = TRADE_GROUPS.map(
      (g) =>
        `<tr><td><span class="swatch" style="background:${tradeColor(g.id)}"></span>${escape(g.label)}</td><td>${percent(t.exports === 0 ? 0 : (t.exportsByGroup[g.id] / t.exports) * 100)}</td><td>${roundDollars(t.exportsByGroup[g.id])}</td></tr>`,
    );
    const products = t.topExports.map(
      (p) => `<tr><td>${escape(p.name)}</td><td>${roundDollars(p.usd)}</td><td>${p.worldRank <= 10 ? `#${p.worldRank} in the world (${percent(p.worldShare)})` : ""}</td></tr>`,
    );
    const partners = t.exportPartners.map((p) => `${escape(p.name)} (${percent((p.usd / t.exports) * 100)})`).join(", ");
    sections.push(
      `<section><h2>Trade</h2>${table([
        ["Goods exports", withYear(dollars(t.exports), t)],
        ["Goods imports", withYear(dollars(t.imports), t)],
        ["Trade balance", withYear(signed(t.exports - t.imports), t)],
      ])}` +
        `<h3>What it exports</h3><table class="list"><thead><tr><th>Category</th><th>Share</th><th>Amount</th></tr></thead><tbody>${groups.join("")}</tbody></table>` +
        `<h3>Top exports</h3><table class="list"><thead><tr><th>Product</th><th>Amount</th><th>World rank</th></tr></thead><tbody>${products.join("")}</tbody></table>` +
        `<p>Main buyers: ${partners}.</p><p class="note">${escape(SOURCES[t.source].name)}. Goods only.</p></section>`,
    );
  }

  const m = d.military;
  sections.push(`<section><h2>Military</h2>${table([
    ["Military spending", m.spendingUsd === null ? null : withYear(dollars(m.spendingUsd.value), m.spendingUsd)],
    ["Spending per person", num(m.spendingPerPerson, (v) => `$${fullNumber(v)}`)],
    ["Spending, % of GDP", num(m.spending, (v) => percent(v))],
    ["Active personnel", m.personnel === null ? null : withYear(m.personnel.low === m.personnel.high ? fullNumber(m.personnel.value) : `${fullNumber(m.personnel.low)}–${fullNumber(m.personnel.high)}`, m.personnel)],
  ])}${m.personnel === null ? "" : `<p class="note">${escape(m.personnel.note)}. CIA World Factbook estimates.</p>`}</section>`);

  const resources = d.resources.filter((r) => r.production !== null || r.reserves !== null);
  if (resources.length > 0) {
    const cell = (a: (typeof resources)[number]["production"]) =>
      a === null ? "—" : `${escape(amount(a))}${a.worldRank === null ? "" : ` <span class="year">#${a.worldRank}</span>`}`;
    sections.push(`<section><h2>Resources</h2><table class="list"><thead><tr><th>Resource</th><th>Production</th><th>Reserves</th></tr></thead><tbody>${resources
      .map((r) => `<tr><td>${escape(r.name)}</td><td>${cell(r.production)}</td><td>${cell(r.reserves)}</td></tr>`)
      .join("")}</tbody></table><p class="note">#n = world rank.</p></section>`);
  }

  if (d.agriculture !== null && d.agriculture.largest.length > 0) {
    sections.push(`<section><h2>Agriculture</h2><table class="list"><thead><tr><th>Product</th><th>Production</th><th>World rank</th><th>World share</th></tr></thead><tbody>${d.agriculture.largest
      .map((c) => `<tr><td>${escape(c.name)}</td><td>${tonnes(c.tonnes)}</td><td>#${c.worldRank}</td><td>${share(c.worldShare)}</td></tr>`)
      .join("")}</tbody></table><p class="note">${d.agriculture.year}, FAOSTAT.</p></section>`);
  }

  const gen = d.power.generation;
  sections.push(`<section><h2>Power generation</h2>${table([
    ["Electricity generated", gen === null ? null : withYear(`${fullNumber(gen.totalTwh)} TWh`, gen)],
    ["Access to electricity", num(d.power.electricityAccess, (v) => percent(v))],
  ])}${
    gen === null
      ? ""
      : `<table class="list"><thead><tr><th>Source</th><th>TWh</th><th>Share</th></tr></thead><tbody>${gen.mix
          .map((m) => `<tr><td>${POWER_SOURCE_STYLE[m.source].label}</td><td>${m.twh.toLocaleString("en-US", { maximumFractionDigits: 1 })}</td><td>${share(m.twh / gen.totalTwh)}</td></tr>`)
          .join("")}</tbody></table>`
  }</section>`);

  const compareLinks = (ids: string[]) =>
    `<ul class="link-grid">${ids
      .map((id) => `<li><a href="${root}${comparePath(site, d.id, id)}">${escape(d.name)} vs ${escape(site.byId.get(id)!.name)}</a></li>`)
      .join("")}</ul>`;
  const nearby = site.nearby[d.id];
  sections.push(`<section><h2>Compare ${escape(d.name)}</h2><h3>Neighbours and nearby countries</h3>${compareLinks(nearby)}<h3>G20 countries</h3>${compareLinks(
    G20.filter((id) => id !== d.id && !nearby.includes(id)),
  )}<p class="note">Or pick any country on the <a href="${root}?c=${d.id}">map</a> and right-click (long-press) another.</p></section>`);

  return page({
    path,
    title: `${d.name}: Power Level, population, GDP and economy | World Tracker`,
    previewTitle: d.name,
    description:
      `${d.name}: Power Level ${powerLevelText(d)}` +
      (p.total === null ? "" : `, population ${inWords(p.total.value)}`) +
      (e.gdp === null ? "" : `, GDP $${inWords(e.gdp.value)}`) +
      `. Government, economy, resources, energy and food data, with comparisons.`,
    image: cardOf(d.id, null),
    builtAt: site.meta.builtAt,
    body: `<h1>${flag(root, d.id)}${escape(d.name)}</h1><p class="lead">${escape(lead)}</p><a class="cta" href="${root}?c=${d.id}">Open ${escape(d.name)} on the interactive map</a>${sections.join("")}`,
  });
}

interface Metric {
  label: string;
  get: (d: CountryData) => number | null;
  format: (v: number) => string;
  better?: Better;
  mode?: DiffMode; // how the gap is said, see Compare.tsx
}

// Comparison page rows, by section, same rules as the app's comparison panel (src/ui/info/Compare.tsx).
const METRIC_GROUPS: { title: string; metrics: Metric[] }[] = [
  {
    title: "Power Level",
    metrics: [
      { label: "Power Level", get: (d) => d.powerLevel?.score ?? null, format: (v) => v.toFixed(1), mode: "score" },
      ...PILLAR_ORDER.map(
        (pillar): Metric => ({
          label: PILLAR_LABELS[pillar],
          get: (d) => d.powerLevel?.pillars[pillar] ?? null,
          format: (v) => v.toFixed(0),
          mode: "score",
        }),
      ),
    ],
  },
  {
    title: "Population",
    metrics: [
      { label: "Population", get: (d) => d.population.total?.value ?? null, format: fullNumber },
      { label: "Density (per km²)", get: (d) => d.population.density?.value ?? null, format: fullNumber, better: "none" },
      { label: "Children per woman", get: (d) => d.population.fertility?.value ?? null, format: (v) => v.toFixed(2) },
      { label: "Life expectancy", get: (d) => d.population.lifeExpectancy?.value ?? null, format: (v) => `${v.toFixed(1)} years`, mode: "years" },
      { label: "Median age", get: (d) => d.population.medianAge?.value ?? null, format: (v) => `${v.toFixed(1)} years`, better: "none", mode: "years" },
    ],
  },
  {
    title: "Economy",
    metrics: [
      { label: "GDP", get: (d) => d.economy.gdp?.value ?? null, format: dollars },
      { label: "GDP per person", get: (d) => d.economy.gdpPerCapita?.value ?? null, format: dollars },
      { label: "GDP per person (PPP)", get: (d) => d.economy.gdpPerCapitaPpp?.value ?? null, format: dollars },
      { label: "Real growth", get: (d) => d.economy.growth?.value ?? null, format: (v) => percent(v), mode: "points" },
      { label: "Inflation", get: (d) => d.economy.inflation?.value ?? null, format: (v) => percent(v), better: "lower", mode: "points" },
      { label: "Gov. debt (% of GDP)", get: (d) => d.economy.debt?.value ?? null, format: (v) => percent(v, 0), better: "lower", mode: "points" },
    ],
  },
  {
    title: "Government budget",
    metrics: [
      { label: "Government spending (% of GDP)", get: (d) => d.economy.budget?.percentOfGdp ?? null, format: (v) => percent(v), better: "none", mode: "points" },
      ...BUDGET_FUNCTIONS.slice(0, 6).map((f) => ({
        label: `${f.label} (% of budget)`,
        get: (d: CountryData) => (d.economy.budget === null ? null : budgetShare(d.economy.budget, f.id)),
        format: (v: number) => percent(v),
        better: "none" as const,
        mode: "points" as const,
      })),
    ],
  },
  {
    title: "Trade",
    metrics: [
      { label: "Goods exports", get: (d) => d.trade?.exports ?? null, format: dollars },
      { label: "Goods imports", get: (d) => d.trade?.imports ?? null, format: dollars, better: "none" },
      { label: "Trade balance", get: (d) => (d.trade === null ? null : d.trade.exports - d.trade.imports), format: (v) => (v < 0 ? `−${dollars(-v)}` : `+${dollars(v)}`), better: "none" },
    ],
  },
  {
    title: "Military",
    metrics: [
      { label: "Military spending", get: (d) => d.military.spendingUsd?.value ?? null, format: dollars },
      { label: "Spending per person", get: (d) => d.military.spendingPerPerson?.value ?? null, format: (v) => `$${fullNumber(v)}` },
      { label: "Spending (% of GDP)", get: (d) => d.military.spending?.value ?? null, format: (v) => percent(v), better: "none", mode: "points" },
      { label: "Active personnel", get: (d) => d.military.personnel?.value ?? null, format: fullNumber },
    ],
  },
  {
    title: "Government and energy",
    metrics: [
      { label: "Political stability", get: (d) => d.government.politicalStability?.value ?? null, format: (v) => `${v.toFixed(0)} / 100`, mode: "score" },
      { label: "Electricity generated", get: (d) => d.power.generation?.totalTwh ?? null, format: (v) => `${fullNumber(v)} TWh` },
      { label: "Access to electricity", get: (d) => d.power.electricityAccess?.value ?? null, format: (v) => percent(v), mode: "points" },
    ],
  },
];

// One row like the app's comparison panel: label | A's bar + value / B's bar + value / the gap from the winner's
// side. Bars share one scale; the winner's value is a teal pill, the loser's bar dimmer.
function pairRow(m: Metric, va: number | null, vb: number | null): string {
  const compare = { a: va, b: vb, format: m.format, better: m.better, mode: m.mode };
  const win = winner(compare);
  const [wa, wb] = barWidths(compare);
  const g = gap(compare);
  const bar = (side: "a" | "b", width: number) =>
    `<span class="pair-bar ${side}${win !== null && win !== side ? " lose" : ""}"><span style="width:${width.toFixed(1)}%"></span></span>`;
  const value = (v: number | null, wins: boolean) => `<span class="pair-value${wins ? " win" : ""}">${v === null ? "No data" : escape(m.format(v))}</span>`;
  return (
    `<div class="pair"><div class="pair-label">${escape(m.label)}</div><div class="pair-bars">` +
    bar("a", wa) +
    value(va, win === "a") +
    bar("b", wb) +
    value(vb, win === "b") +
    (g === null ? "" : `<span class="pair-gap"><i class="swatch ${g.side}"></i>${escape(g.text)}</span>`) +
    `</div></div>`
  );
}

function comparePage(site: Site, a: CountryData, b: CountryData, path: string, image: string): string {
  const root = rootFrom(path);
  const sections = METRIC_GROUPS.map((group) => {
    const rows = group.metrics
      .map((m) => ({ m, va: m.get(a), vb: m.get(b) }))
      .filter((r) => r.va !== null || r.vb !== null)
      .map((r) => pairRow(r.m, r.va, r.vb))
      .join("");
    return rows === "" ? "" : `<section class="pairs"><h2>${escape(group.title)}</h2>${rows}</section>`;
  }).join("");

  const la = a.powerLevel;
  const lb = b.powerLevel;
  const verdict =
    la !== null && lb !== null && la.score !== lb.score
      ? ` ${la.score > lb.score ? a.name : b.name} has the higher Power Level (${Math.max(la.score, lb.score).toFixed(1)} vs ${Math.min(la.score, lb.score).toFixed(1)}).`
      : "";
  const title = `${a.name} vs ${b.name}: population, GDP and Power Level compared | World Tracker`;
  // Pairs with their own share card show it: the same poster people see when the link is shared.
  const hero = image.includes("-vs-") ? `<img class="hero-card" src="${root}${image}" alt="${escape(`${a.name} vs ${b.name} Power Level comparison`)}" width="1200" height="630">` : "";
  const key = `<div class="pair-key"><span class="key a">${countryLink(site, root, a.id)}</span><span class="key b">${countryLink(site, root, b.id)}</span></div>`;

  return page({
    path,
    title,
    previewTitle: `${a.name} vs ${b.name}`,
    description: `${a.name} vs ${b.name} side by side: Power Level, population, GDP, growth, inflation, debt, military, stability and electricity.${verdict}`,
    image,
    builtAt: site.meta.builtAt,
    body:
      `<h1>${flag(root, a.id)}${escape(a.name)} vs ${flag(root, b.id)}${escape(b.name)}</h1>` +
      `<p class="lead">${escape(`${a.name} and ${b.name} compared on population, economy, military, government, energy and World Tracker’s Power Level.${verdict}`)}</p>` +
      `<a class="cta" href="${root}?c=${a.id}&amp;vs=${b.id}">Open this comparison on the interactive map</a>` +
      hero +
      key +
      sections +
      `<p class="note">Teal = better (lower for inflation and debt; none for density and median age). Years differ by country; see each country’s page.</p>`,
  });
}

// The list view's number columns, by section, that have enough countries for a ranking page and a map page
// (the same ones the map's "Color countries by" offers).
function rankingGroups(site: Site): MappableGroup[] {
  return mappableGroups(columnGroups(site.meta.resources), [...site.summaries.values()]);
}

function rankPage(site: Site, column: NumberColumn, path: string): string {
  const root = rootFrom(path);
  const ranked = site.countries
    .map((d) => ({ d, value: column.value(site.summaries.get(d.id)!) }))
    .filter((r): r is { d: CountryData; value: number } => r.value !== null)
    .sort((x, y) => y.value - x.value);
  const top = ranked.slice(0, 3).map((r) => r.d.name);
  const label = column.fullLabel;
  return page({
    path,
    title: `Countries by ${label}: full ranking | World Tracker`,
    previewTitle: `Countries by ${label}`,
    description: `All ${ranked.length} countries ranked by ${label.toLowerCase()}, highest first. Top three: ${top.join(", ")}.`,
    image: cardOf(ranked[0].d.id, null),
    builtAt: site.meta.builtAt,
    body:
      `<h1>Countries by ${escape(label)}</h1><p class="lead">${ranked.length} countries, highest first. Latest available year for each country.</p>` +
      `<a class="cta" href="${root}?view=list&amp;sort=${column.id}.desc">Open this ranking in the interactive list</a> ` +
      `<a class="cta secondary" href="${root}map/${column.slug}/">See it on a world map</a>` +
      `<table class="list ranking"><thead><tr><th>#</th><th>Country</th><th>${escape(label)}</th></tr></thead><tbody>${ranked
        .map((r, i) => `<tr><td>${i + 1}</td><td>${countryLink(site, root, r.d.id)}</td><td>${escape(column.format(r.value))}</td></tr>`)
        .join("")}</tbody></table>`,
  });
}

// The world colored by one number (the map's "Color countries by", map/colorBy.ts), its image, and the top 20.
function mapPage(site: Site, scale: ColorScale, path: string, image: string): string {
  const root = rootFrom(path);
  const label = scale.column.fullLabel;
  const value = (v: number) => valueWithUnit(scale.column, v);
  const top = scale.ranked[0];
  return page({
    path,
    title: `World map of ${label} | World Tracker`,
    previewTitle: `World map: ${label}`,
    description: `${label} in ${scale.ranked.length} countries on one map, lowest to highest. Highest: ${top.name} (${value(top.value)}). Median: ${value(scale.median)}. Source: ${scale.group.sources}.`,
    image,
    builtAt: site.meta.builtAt,
    body:
      `<h1>World map: ${escape(label)}</h1>` +
      `<p class="lead">${scale.ranked.length} countries, colored from lowest (${escape(value(scale.min))}) to highest (${escape(value(scale.max))}). Median ${escape(value(scale.median))}. Countries in plain blue have no data.</p>` +
      `<a class="cta" href="${root}?map=${scale.column.id}">Open this map on the interactive site</a>` +
      `<img class="hero-card" src="${root}${image}" alt="${escape(`World map of ${label}`)}" width="1200" height="630">` +
      `<section><h2>Top 20</h2><table class="list ranking"><tbody>${scale.ranked
        .slice(0, 20)
        .map((r, i) => `<tr><td>${i + 1}</td><td>${countryLink(site, root, r.id)}</td><td>${escape(value(r.value))}</td></tr>`)
        .join("")}</tbody></table><p class="note"><a href="${root}rank/${scale.column.slug}/">All ${scale.ranked.length} countries ranked</a> · Sources: ${escape(scale.group.sources)}. Colors by rank, so each color holds about as many countries.</p></section>`,
  });
}

function hubPage(site: Site): string {
  const path = "countries/";
  const root = rootFrom(path);
  const sorted = [...site.countries].sort((x, y) => x.name.localeCompare(y.name));
  const top = [...site.countries].filter((d) => d.powerLevel !== null).sort((x, y) => x.powerLevel!.rank - y.powerLevel!.rank)[0];
  return page({
    path,
    title: "All countries and rankings | World Tracker",
    previewTitle: "All countries and rankings",
    description: `Data pages for ${site.countries.length} countries and territories, and rankings by Power Level, population, GDP, growth, inflation and debt.`,
    image: cardOf(top.id, null),
    builtAt: site.meta.builtAt,
    body:
      `<h1>Countries &amp; rankings</h1><p class="lead">Every country on World Tracker, and every ranking. ` +
      `Think you know them? <a href="${root}${GAME_URL}">Try the daily challenge</a>, Higher or Lower, and the flag and outline quizzes.</p>` +
      `<section><h2>Rankings</h2>${rankingGroups(site)
        .map(
          (g) =>
            `<h3>${escape(g.group.label)}</h3><ul class="link-grid">${g.columns
              .map((c) => `<li><a href="${root}rank/${c.slug}/">Countries by ${escape(c.fullLabel)}</a> · <a href="${root}map/${c.slug}/">map</a></li>`)
              .join("")}</ul>`,
        )
        .join("")}</section>` +
      `<section><h2>All countries</h2><ul class="link-grid">${sorted
        .map((d) => `<li>${countryLink(site, root, d.id)}${d.powerLevel === null ? "" : ` <span class="year">${d.powerLevel.score.toFixed(1)}</span>`}</li>`)
        .join("")}</ul></section>`,
  });
}

function sitemap(paths: string[], builtAt: string): string {
  const urls = paths.map((p) => `<url><loc>${SITE_URL}${p}</loc><lastmod>${builtAt}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
