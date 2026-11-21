# World Tracker — architecture notes

Before any UI work, read DESIGN.md (how data is presented: comparisons, colors, numbers, cards).

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
npm run test:mobile    # phone layout + real touch gestures via CDP (needs `npm run build` first)
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
  MapView.ts              Owns the canvas: frame loop (redraw only when dirty), drawing, hit testing, mouse/trackpad input
  TouchGestures.ts        Touch -> pan / pinch zoom / tap / long press, fed by MapView's pointer handlers
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
src/ui/useMobile.ts       Phone layout switch (max-width 700px, same as the @media block at the end of styles.css)
src/ui/info/useBottomSheet.ts  Phone: info panel as bottom sheet, peek/half/full snaps, header drag + tap
src/ui/info/PowerLevelCard.tsx  Power Level score, rank and pillar bars at the top of the info panel
src/map/heatColors.ts     Heat colours for "Color countries by: Power Level" (App builds a fill map, MapView.setFillOverrides)
src/share/comparisonCard.ts  Comparison share image: the "fight poster" (DESIGN.md §6)
src/share/draw.ts         Canvas helpers for the cards (text, fit, masks, color mix); Outfit font (public/fonts, OFL)
src/share/shareCard.ts    1200x630 share image entry (one country / comparison), loadCardAssets (Outfit + large flags
                          public/flags/large/<ID>.png 480x360) must run before drawing; silhouettes re-projected per
                          country (rotated to its longitude, parts >40° from the label point dropped: no French Guiana)
src/ui/ShareDialog.tsx    Share button's dialog: preview, Copy link, Download image, native Share… on phones. The link is the
                          country/comparison static page (its preview shows the card); pairs without a page: map URL
src/data/sitePages.ts     Which static pages exist + their addresses (G20 list, slugs). No imports: Node loads it too
about.html + src/about/   Sources & method page (second Vite entry, see vite.config.ts): data date (public/data/meta.json),
                          Power Level method, source + license table. Weights/licenses come from countryData.ts;
                          the method text and the datasets table are kept in sync with the pipeline by hand
src/ui/info/TrendChart.tsx  Trend charts: rows with history (CountryData.trends: 9 World Bank indicators, 2000-latest,
                          fetched in fetch/worldbank.ts) get a chart icon; click opens an SVG line chart, two lines when
                          comparing; pointer = year readout; press-and-drag = measure the change between two years
                          (%, pp or years per TrendInput.change; touch: sideways drag). TrendRow wraps any FactRow. The latest value of those 9
                          indicators also comes from the history (mrnev=1 dropped values, Nov 2026)
src/ui/ModeSwitch.tsx     Map | Play switch, pinned to the same spot on both pages (top center; phones: after the ☰ slot at
                          64px; tests check it). Own CSS: modeSwitch.css. Play has a
                          dot until today's daily is done; going to Play saves the map's ?query (sessionStorage) so
                          Map returns to the same view
src/ui/Flag.tsx           Flag chip before country names (info header, list, search, comparison rows, Power Level card).
                          public/flags/<ID>.png, 96x72 (+ large/ 480x360 for cards), built by scripts/build-flags.mjs from flag-icons (MIT);
                          every id has a file (grey placeholder for Northern Cyprus, Somaliland, Siachen).
                          Comparison: header names underlined in map colors = the color key; spans .flag-a/.flag-b
                          get the images from CSS vars --flag-a/--flag-b on the info panel (absolute URLs)
play.html + src/game/     Games, tabs by ?mode= (PlayPage.tsx): daily (default; Daily.tsx + daily.ts: 10 Higher-or-Lower
                          questions seeded by the UTC date, one attempt/day, 🟩🟥 share grid), endless Higher or Lower
                          (HigherLower.tsx + game.ts), flags / outlines (Quiz.tsx + quiz.ts: 4 options, 2 from the
                          answer's neighbours, 3 lives). random.ts = seeded RNG; shared.tsx = data, card, share, best
                          scores (localStorage). Pool: 1M+ people and a Power Level
embed.html + src/embed/   Card for other websites in an iframe: ?c=ID[&vs=ID][&theme=light]. Links to the static page
                          (or the map). Code from the Share dialog (src/share/embed.ts: iframe + a plain backlink;
                          EMBED_SIZE heights measured from embed.css). noindex; analytics on
src/share/silhouette.ts   One country's outline in a box (share cards, outline quiz)
src/links.ts              URLs of the about page, the countries hub, the issue tracker, SITE_URL (absolute address),
                          and the Cloudflare Web Analytics snippet (injected by vite.config.ts + scripts/site/html.ts;
                          tests block it so test runs aren't counted)
share-card.html + src/share/cardPage.ts  Headless page that draws link-preview cards at build time (not linked)

scripts/site/             Static pages for search engines + link previews, added to dist/ by `npm run build:site`
  build-site.mjs          Entry. Loads the TS modules through Vite (they import the app's formatters/columns/labels)
  pages.ts                countries/ hub, country/<slug>/, rank/<key>/, compare/<a>-vs-<b>/, sitemap.xml.
                          Which pairs get a page and the addresses: src/data/sitePages.ts (shared with the app's
                          Share button). Pairs people search for: each G20 country vs every country, plus each
                          country vs its neighbours/nearest countries (data/nearby.json). Not every pair: ~29k pages of
                          pairs nobody searches would read as filler to Google (Mishiko agreed).
                          og:title is short ("Russia vs United States"); <title> keeps keywords for Google
  cards.ts                Renders those cards (JPEG, ~60 KB) with share-card.html in headless Chrome, plus
                          cards/home.jpg (world in Power Level colors) = preview of index.html/about.html
                          (og: tags injected by the preview-image plugin in vite.config.ts)
  notFound.ts             404.html: forwards guessed addresses (compare/usa-vs-russia, country/uk, /georgia) to the
                          real page, or a pair without a page to the map. Aliases: slugs, ISO codes, EXTRA_ALIASES
  html.ts                 Page layout (title, description, canonical, og: tags), escaping, slugs
  site.css                Styles of the static pages
  Deploy runs it after `npm run build`, then `npm run test:site` (links, preview tags, sitemap, 404 forwarding)
  and stops if anything fails.
src/urlState.ts           ?c=ESP&vs=FRA&view=list&sort=gdp.desc  read once on load, written with replaceState
src/ui/list/              List view (settings.listView): CountryList (sortable table of public/data/summary.json),
                          columns.ts (column groups = info panel sections; adding a column = CountrySummary field +
                          build.ts summaryOf + one entry here; number columns with 15+ countries get a rank/<slug>/ page)

scripts/data/             Data pipeline (TypeScript run directly by Node 22, no build step)
  run.ts                  Entry: runs steps in order, keeps going after a failure, exits non-zero if any failed
  lib/countries.ts        Our country list + code/name matchers (CODE_OVERRIDES, NAME_OVERRIDES for odd sources)
  lib/io.ts, lib/csv.ts   fetch helpers (errors use labels, never URLs: API keys), cache read/write, CSV parsing
  fetch/<source>.ts       One per source -> data-cache/<source>.json, already keyed by our country id
  nearby.ts               Each country's land neighbours + 5 nearest countries -> public/data/nearby.json
  audit.ts                Compares fresh data with a git ref: stale data, coverage drops, lost values,
                          implausible values, big jumps, Power Level rank moves. Runs in data.yml (report in the
                          run's summary); a monthly Claude scheduled task (3rd of the month) checks the flags against
                          the sources and reports to Mishiko. Never fails the build
  powerLevel.ts           Power Level index (our own metric). Runs inside build.ts after all countries are built
  build.ts                Caches -> public/data/countries/<id>.json + summary.json (list view) + meta.json (build date,
                          Power Level version) + coverage report. No network.

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
| Economy | GDP (+rank), per capita, PPP, growth, inflation, central gov. debt | World Bank (worldbank) | Was IMF until Nov 2026: IMF terms forbid systematic download / commercial reuse without permission. WB = CC BY 4.0. No Taiwan. Debt is central gov (fewer countries, lags); debt $ = % × GDP of the debt's year (gdpByYear) |
| Resources | oil/gas/coal production, coal reserves | EIA API (eia), key in secret EIA_API_KEY | EIA dropped oil/gas reserves from its API |
| | oil/gas reserves | EIA via OWID grapher CSVs (reserves) | Ends 2021. EI stopped 2020; OPEC has newer but blocks bots (403) |
| | minerals production + reserves | USGS MCS data release (usgs) | Update SCIENCEBASE_ITEM each new edition (Jan/Feb). One variant per mineral |
| Agriculture | largest products, world top-10 | FAOSTAT bulk zip (faostat) | 545 MB CSV streamed via `unzip -p`. Excludes FAO aggregate items/areas |
| Power | generation mix (sums to total) | Ember + EI via OWID energy-data on GitHub (energy) | |
| | access to electricity | World Bank (worldbank) | |
| Government | political stability (0-100) | World Bank WGI (worldbank, GOV_WGI_PV_SC) | Perception-based. Power Level stability pillar |

SECURITY: never write URLs containing the EIA key to files or logs. A leak happened once via curl error output.

## Key decisions (agreed with Mishiko, Nov 2026)

- **Stack:** Vite + TypeScript + React for panels; map is a hand-written Canvas2D renderer (no map library),
  so RMB pan, wrap, zoom feel and the 3 country states are fully under our control.
- **Projection:** Web Mercator; Antarctica excluded; vertical extent 84N..60S. Same math as web tiles, so
  tile layers need no reprojection.
- **Geometry:** Natural Earth 50m. Microstates get a clickable dot while they are under 6 px on screen.
- **Borders:** Natural Earth default (de facto control): Kosovo, Taiwan, Somaliland, N. Cyprus, W. Sahara are separate.
  Overseas parts belong to the parent (French Guiana selects France). Country id = Natural Earth ADM0_A3.
- **Controls:** left click selects (A), right click compares (B), middle drag pans, wheel zooms. A drag (>5 px) is
  never a click. MapView only reports clicks; App.tsx owns the rules: compare needs A selected and B != A; new left
  selection ends a comparison; right click on ocean / ✕ in panel header ends it; ocean left click or Esc clears all.
  List view uses the same rules (left/right click on rows). The info panel's "Compare" button starts picking mode:
  the next left click / tap compares instead of selecting (ocean cancels).
  Touch: one finger pans, pinch zooms, tap = left click, long press (500 ms) = right click.
  Trackpad pinch arrives as wheel + ctrlKey (Chrome/Firefox) or gesturestart/gesturechange (Safari) and zooms
  immediately (no glide). Safari's gesture events are ignored while fingers are down (touch handles those).
- **Phones sideways (≤500px tall, >700px wide):** settings start closed and open full screen; the info panel is
  a slim full-height side panel (320px, 360 comparing). isCompactNow() in useMobile.ts.
- **Phones (≤700px wide):** settings start closed and open as a full-screen drawer; info panel is a bottom sheet
  (peek 172px = name + Power Level score, half, full); list view goes full width.
- **Comparison mode:** (src/ui/info/Compare.tsx, FactRow.tsx). A sticky legend names both countries in their map
  colors (selected/compared fill of the current map type, CSS vars --color-a/--color-b). Number rows look like the
  Power Level card: two bars (scaled to the larger value) with values, better value green (higher, or lower for
  inflation/debt; none for median age, density, age groups), then how much more/less B has: "8.3× more" from 2×,
  else "22% more"; pp for percentage values, points for 0-100 scores, years for ages. Text rows (government) show
  both values with color swatches. Red is never "worse" because A is red on the map. Panel widens to 400px.
- **Info panel:** no source/year lines (clutter); year + source are the value's tooltip.
- **Zoom:** toward cursor, 1x (world height fills viewport) to 40x; exponential glide in log space.
- **List view:** toggle in the left panel. The map stays mounted but hidden (camera survives). Sorting: first click
  highest first (name and text A→Z), second click reverses, missing values always last. Row click = select (opens info panel).
  Columns are grouped like the info panel's sections (Power Level + pillars, Government incl. text columns, Population
  incl. age groups, Economy, Resources: production, Resources: reserves, Agriculture = 15 staples (STAPLES in
  countryData.ts), Power generation by source). A group header collapses it to a narrow "+" strip; collapsed groups
  are saved in settings.listCollapsed (resources start collapsed: dozens of columns). Resource columns come from
  meta.json `resources` (resources with 3+ countries, energy first then A-Z, unit per resource). Cells carry
  data-column=<column id> (tests). A sort id with no column (old link) falls back to Power Level.
- **Info panel layout:** fixed label column, values left-aligned right after it. Resource lists show everything
  available (no truncation), by Mishiko's choice.
- **Map types:** Dark (default), Light, Satellite. Each map type has its own colors in settings.
  Satellite = NASA GIBS Blue Marble shaded relief (public domain, no key, max tile level 8 so soft when zoomed far).
  Swap or add sources in mapTypes.ts.
- **Data:** static per-country JSON built monthly by scripts/data from free sources (see Data pipeline). No backend.
  **Licensing rule (the site will be monetized):** only sources that allow commercial reuse. IMF and SIPRI do not
  (written permission / paid license needed), so neither is used. Military data is parked until a license is funded.
  Every value carries its year and source; missing = null = "No data" (never 0).
- **Hosting:** GitHub repo + GitHub Pages (workflow in .github/workflows/deploy.yml). `base: "./"` in vite config.

## Power Level (powerLevel.ts, POWER_LEVEL_VERSION)

Original 0-100 index, the site's signature number. Six pillars, each 0-100, weighted:
economy 0.40, resources 0.15, population 0.15, energy 0.15, food 0.10, stability 0.05.
- Every economic number (GDP, PPP, growth, inflation, debt) belongs in the economy pillar (Mishiko's rule).
  Stability = World Bank WGI political stability score only (GOV_WGI_PV_SC, also shown in Government).
- Size values (GDP, population, generation) use (v/max)^0.3 so giants don't flatten everyone else;
  per-capita values use log min-max; world shares (resources, food) use sqrt(v/max).
- A missing pillar's weight is redistributed over the others. No score without economy + population, or with
  fewer than 5 of the 6 pillars (v3/v4: with few pillars one number swung small territories' scores).
- Rank is among countries with a score. build.ts prints the top 30: check it after any formula change,
  and bump POWER_LEVEL_VERSION when the formula changes.

## Conventions

- Errors surface; no defensive try/catch or silent fallbacks (Mishiko's preference).
- Simplest thing that works; no speculative abstractions.
- Map code is plain classes with explicit state; React never touches the canvas directly.
- Comments explain *why* and the units/spaces involved (world units vs CSS px vs device px).
- Run `npm run test:controls` after touching anything in src/map/ or the panels; `npm run test:mobile` for touch
  and phone layout. Check their exit code / last line: a crash mid-run prints no FAIL lines.

## Known limitations / ideas

- Satellite imagery tops out at ~600 m/px. Sharper options: EOX Sentinel-2 cloudless (non-commercial licence),
  Esri World Imagery (terms), MapTiler (API key).
- Artifact previews on claude.ai block remote images, so satellite only works on Pages / localhost.
- 50m coastlines look coarse past ~20x; could swap to 10m geometry when zoomed in.
- Safari pinch is tested with simulated gesture events (no Safari in CI).
- Debt: World Bank central gov. debt covers ~60 countries. If the IMF grants permission, IMF becomes the
  economy source with World Bank as fallback.
