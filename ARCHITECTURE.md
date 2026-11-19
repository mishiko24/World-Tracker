# World Tracker — architecture notes

Written for whoever maintains this code next (Claude, in a later session). Read this first.

## What it is

Interactive world map website. Hover highlights a country, left-click selects it and opens the
right info panel (government, population, economy, resources, power generation). Left panel holds
map type and visual/camera settings. Static site, no backend.

## Run

```
npm install
npm run dev            # local dev server
npm run build          # type-check + production build into dist/
npm run build:geo      # rebuild public/data/countries.topo.json from data-raw/
npm run test:controls  # headless browser test of all controls (needs `npm run build` first; starts its own preview server)
node tests/panel-screenshot.mjs <lon> <lat> out.png   # screenshot the info panel for a country (after build)
node scripts/data/run.ts [steps]                       # data pipeline, see below
```

## File map

```
scripts/build-geo.mjs     Natural Earth GeoJSON -> public/data/countries.topo.json (drops Antarctica, keeps id/name/iso/wikidata/label point)
data-raw/                 Untouched source data (Natural Earth 50m admin-0)
public/data/              Data files the site fetches at runtime

src/main.tsx              React entry
src/App.tsx               Top-level state: countries, settings, selectedId. Wires panels to the map.
src/settings.ts           Settings shape, per-map-type default styles, localStorage load/save (versioned key)

src/map/                  Everything canvas. No React in here.
  geo.ts                  World space definition (Mercator, WORLD_WIDTH=1000, lat 84N..60S) + loadCountries()
                          -> Country objects with pre-built Path2Ds, bounds, label point, size
  Camera.ts               World <-> screen math. x wraps forever, y and zoom are clamped.
  MapView.ts              Owns the canvas: frame loop (redraw only when dirty), drawing, hit testing, mouse input
  TileLayer.ts            Raster tiles (z/x/y) under the countries, ancestor fallback while loading, LRU cache
  mapTypes.ts             The map type list (dark/light/satellite) and which tile source each uses

src/ui/                   React panels
  MapCanvas.tsx           Thin wrapper: creates MapView once, pushes settings/selection into it
  SettingsPanel.tsx       Left panel: map type dropdown, per-state style controls, zoom controls
  InfoPanel.tsx           Right panel: country name + collapsible sections (placeholders until data phase)
  Collapsible.tsx         Collapsed-by-default section
  controls.tsx, format.ts Slider / color inputs and value formatting

src/data/countryData.ts   THE CONTRACT: per-country JSON shape + source list. Imported by both the pipeline and the UI.
src/ui/info/              Right panel: InfoPanel (6 sections), useCountryData (fetch), FactRow, one file per section type,
                          formatData (number/unit formatting)

scripts/data/             Data pipeline (TypeScript run directly by Node 22, no build step)
  run.ts                  Entry: runs steps in order, keeps going after a failure, exits non-zero if any failed
  lib/countries.ts        Our country list + code/name matchers (CODE_OVERRIDES, NAME_OVERRIDES for odd sources)
  lib/io.ts, lib/csv.ts   fetch helpers (errors use labels, never URLs: API keys), cache read/write, CSV parsing
  fetch/<source>.ts       One per source -> data-cache/<source>.json, already keyed by our country id
  build.ts                Caches -> public/data/countries/<id>.json + coverage report. No network.

data-cache/               Committed. Normalized per-source data; git diffs show what each refresh changed.
public/data/countries/    Committed. What the site loads when a country is selected.

tests/controls.mjs        Playwright test driving real mouse input, checking canvas pixels; satellite tiles are mocked
```

## Data pipeline

Runs in GitHub Actions (`.github/workflows/data.yml`): monthly cron + manual "Run workflow" with optional
`steps` input (e.g. `imf build`). It commits data-cache/ and public/data/, then calls deploy.yml.
The dev sandbox can only reach GitHub, so fetchers are developed by running them in Actions and reading
the logs (`gh api repos/mishiko24/World-Tracker/actions/jobs/<id>/logs`), then pulling the committed caches.
`energy` (OWID on GitHub) and `build` can run locally.

| Section | Fields | Source (fetcher) | Notes |
|---|---|---|---|
| Government | type | Factbook final edition (factbook) | Frozen (CIA ended it Feb 2026). Matched via Wikidata P9948 slug, else internet TLD |
| | head of state/government, ruling party | Wikidata SPARQL (wikidata) | Current = no end date, preferred rank, then latest start. Ruling party = party of head of government, else of head of state |
| Population | total, density, fertility, life expectancy, age structure | World Bank (worldbank) | `mrnev=1` = latest non-empty per country. UN WPP fallback (Taiwan etc.) |
| | median age | UN WPP via OWID grapher (unwpp) | Estimates only, no projections |
| Economy | GDP (+rank), per capita, PPP, growth, inflation, debt | IMF DataMapper WEO (imf) | Last full year (IMF estimate for some). Rank computed in build.ts |
| Resources | oil/gas/coal production, coal reserves | EIA API (eia), key in secret EIA_API_KEY | EIA dropped oil/gas reserves from its API |
| | oil/gas reserves | Energy Institute via OWID (eireserves) | Stops at 2020. OPEC has newer but blocks bots (403) |
| | minerals production + reserves | USGS MCS data release (usgs) | Update SCIENCEBASE_ITEM each new edition (Jan/Feb). One variant per mineral |
| Agriculture | largest products, world top-10 | FAOSTAT bulk zip (faostat) | 545 MB CSV streamed via `unzip -p`. Excludes FAO aggregate items/areas |
| Power | generation mix (sums to total) | Ember + EI via OWID energy-data on GitHub (energy) | |
| | access to electricity | World Bank (worldbank) | |

SECURITY: never write URLs containing the EIA key to files or logs. A leak happened once via curl error output.

## Key decisions (agreed with Mishiko, Nov 2026)

- **Stack:** Vite + TypeScript + React for panels; map is a hand-written Canvas2D renderer (no map library),
  so RMB pan, wrap, zoom feel and the 3 country states are fully under our control.
- **Projection:** Web Mercator; Antarctica excluded; vertical extent 84N..60S. Same math as web tiles, so
  tile layers need no reprojection.
- **Geometry:** Natural Earth 50m. Microstates get a clickable dot while they are under 6 px on screen.
- **Borders:** Natural Earth default (de facto control): Kosovo, Taiwan, Somaliland, N. Cyprus, W. Sahara are separate.
  Overseas parts belong to the parent (French Guiana selects France). Country id = Natural Earth ADM0_A3.
- **Selection:** click selects, no camera move; clicking the selected country keeps it; ocean click or Esc deselects;
  a left drag (>5 px) is never a click.
- **Zoom:** toward cursor, 1x (world height fills viewport) to 40x; exponential glide in log space.
- **Map types:** Dark (default), Light, Satellite. Each map type has its own colors in settings.
  Satellite = NASA GIBS Blue Marble shaded relief (public domain, no key, max tile level 8 so soft when zoomed far).
  Swap or add sources in mapTypes.ts.
- **Data:** static per-country JSON built monthly by scripts/data from free sources (see Data pipeline). No backend.
  Every value carries its year and source; missing = null = "No data" (never 0).
- **Hosting:** GitHub repo + GitHub Pages (workflow in .github/workflows/deploy.yml). `base: "./"` in vite config.

## Conventions

- Errors surface; no defensive try/catch or silent fallbacks (Mishiko's preference).
- Simplest thing that works; no speculative abstractions.
- Map code is plain classes with explicit state; React never touches the canvas directly.
- Comments explain *why* and the units/spaces involved (world units vs CSS px vs device px).
- Run `npm run test:controls` after touching anything in src/map/.

## Known limitations / ideas

- Satellite imagery tops out at ~600 m/px. Sharper options: EOX Sentinel-2 cloudless (non-commercial licence),
  Esri World Imagery (terms), MapTiler (API key).
- Artifact previews on claude.ai block remote images, so satellite only works on Pages / localhost.
- 50m coastlines look coarse past ~20x; could swap to 10m geometry when zoomed in.
- Desktop/mouse only for now (no touch gestures).
