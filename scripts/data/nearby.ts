// Each country's land neighbours (countries sharing a border line in the map geometry) plus its
// NEAREST_COUNTRIES closest countries by label point, closest first. Decides which regional comparison pages exist
// (src/data/sitePages.ts). Written to public/data/nearby.json by build.ts.
//
// Places without population data (e.g. Siachen Glacier) are never partners; nearest picks also need
// NEAREST_MIN_POPULATION people, so tiny dependencies (Guam, Jersey) don't crowd out real countries.
// Islands have no land neighbours; the nearest countries cover Japan-South Korea, UK-Ireland, etc.

import { geoDistance } from "d3-geo";
import { readFileSync } from "node:fs";
import { neighbors } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { CountryData } from "../../src/data/countryData.ts";
import type { Nearby } from "../../src/data/sitePages.ts";

const NEAREST_COUNTRIES = 5;
const NEAREST_MIN_POPULATION = 500_000;
const TOPOLOGY_FILE = "public/data/countries.topo.json";

interface GeometryProperties {
  id: string;
  label: [number, number];
}

export function computeNearby(all: CountryData[]): Nearby {
  const topo = JSON.parse(readFileSync(TOPOLOGY_FILE, "utf8")) as Topology<{ countries: GeometryCollection<GeometryProperties> }>;
  const geometries = topo.objects.countries.geometries;
  const props = geometries.map((g) => g.properties as GeometryProperties); // build-geo.mjs sets them on every geometry
  const borders = neighbors(geometries);
  const population = new Map(all.map((d) => [d.id, d.population.total?.value ?? null]));

  const nearby: Nearby = {};
  props.forEach((p, i) => {
    const byDistance = props
      .filter((q) => q.id !== p.id && population.get(q.id) !== null)
      .map((q) => ({ id: q.id, distance: geoDistance(p.label, q.label) }))
      .sort((x, y) => x.distance - y.distance);
    const bordering = new Set(borders[i].map((j) => props[j].id));
    const nearest = byDistance
      .filter((x) => population.get(x.id)! >= NEAREST_MIN_POPULATION)
      .slice(0, NEAREST_COUNTRIES)
      .map((x) => x.id);
    nearby[p.id] = byDistance.map((x) => x.id).filter((id) => bordering.has(id) || nearest.includes(id));
  });
  return nearby;
}
