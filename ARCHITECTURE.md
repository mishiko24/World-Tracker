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

tests/controls.mjs        Playwright test driving real mouse input, checking canvas pixels; satellite tiles are mocked
```

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
- **Data (next phase):** static JSON built by scripts from free sources (World Bank, Wikidata, CIA Factbook,
  Ember/OWID for energy). Join on `wikidata` / `iso3` already stored per country. No backend.
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
