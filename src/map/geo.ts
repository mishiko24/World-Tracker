// Loads country shapes and projects them once into "world space".
//
// World space: Web-Mercator, x in [0, WORLD_WIDTH) going west -> east (wraps), y going north -> south.
// Everything the map draws or hit-tests lives in world space; the Camera maps it to the screen.

import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

export const WORLD_WIDTH = 1000;

const TOP_LATITUDE = 84; // north tip of Greenland
const BOTTOM_LATITUDE = -60; // just below South Sandwich Islands; Antarctica is excluded from the data

export const projection = geoMercator()
  .scale(WORLD_WIDTH / (2 * Math.PI))
  .translate([WORLD_WIDTH / 2, WORLD_WIDTH / 2]);

export const WORLD_TOP = projection([0, TOP_LATITUDE])![1];
export const WORLD_BOTTOM = projection([0, BOTTOM_LATITUDE])![1];
export const WORLD_HEIGHT = WORLD_BOTTOM - WORLD_TOP;

interface CountryProperties {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  wikidata: string;
  label: [number, number];
}

export interface Country {
  id: string; // Natural Earth ADM0_A3 code, unique per country
  name: string;
  iso2: string | null;
  iso3: string | null;
  wikidata: string;
  fillPath: Path2D;
  outlinePath: Path2D; // same shape, minus the artificial edges where polygons are cut at the date line
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  labelX: number;
  labelY: number;
  size: number; // sqrt of projected area in world units; tells how big the country looks at a given zoom
  label: [number, number]; // [lon, lat] of the label point, inside the main landmass
  shape: Feature<Polygon | MultiPolygon>; // unprojected, for drawing the country on its own (share cards)
}

const SEAM_EPSILON = 1e-3;

// Which date-line seam a world x sits on: -1 = west edge, 1 = east edge, 0 = neither.
function seamSide(x: number): number {
  if (x < SEAM_EPSILON) {
    return -1;
  }
  if (x > WORLD_WIDTH - SEAM_EPSILON) {
    return 1;
  }
  return 0;
}

// Receives d3-geo drawing calls and writes them into two Path2Ds.
// The outline path skips segments that run along the date line, so Russia and Fiji
// don't get a fake border drawn where the world wraps around.
class CountryPathBuilder {
  fill = new Path2D();
  outline = new Path2D();
  private ringStartX = 0;
  private ringStartY = 0;
  private lastX = 0;

  moveTo(x: number, y: number): void {
    this.fill.moveTo(x, y);
    this.outline.moveTo(x, y);
    this.ringStartX = x;
    this.ringStartY = y;
    this.lastX = x;
  }

  lineTo(x: number, y: number): void {
    this.fill.lineTo(x, y);
    this.outlineTo(x, y);
  }

  closePath(): void {
    this.fill.closePath();
    this.outlineTo(this.ringStartX, this.ringStartY);
  }

  beginPath(): void {
    // Each country is one Path2D, so there is nothing to start.
  }

  arc(): void {
    throw new Error("Point geometries are not expected in country data");
  }

  private outlineTo(x: number, y: number): void {
    const side = seamSide(x);
    if (side !== 0 && side === seamSide(this.lastX)) {
      this.outline.moveTo(x, y);
    } else {
      this.outline.lineTo(x, y);
    }
    this.lastX = x;
  }
}

export async function loadCountries(): Promise<Country[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/countries.topo.json`);
  if (!response.ok) {
    throw new Error(`Failed to load countries: HTTP ${response.status}`);
  }
  const topo = (await response.json()) as Topology<{ countries: GeometryCollection<CountryProperties> }>;
  const collection = feature(topo, topo.objects.countries);
  const measure = geoPath(projection);

  const countries: Country[] = [];
  for (const f of collection.features) {
    const p = f.properties;
    const builder = new CountryPathBuilder();
    geoPath(projection, builder)(f);
    const [[minX, minY], [maxX, maxY]] = measure.bounds(f);
    const [labelX, labelY] = projection(p.label)!;
    countries.push({
      id: p.id,
      name: p.name,
      iso2: p.iso2,
      iso3: p.iso3,
      wikidata: p.wikidata,
      fillPath: builder.fill,
      outlinePath: builder.outline,
      minX,
      minY,
      maxX,
      maxY,
      labelX,
      labelY,
      size: Math.sqrt(measure.area(f)),
      label: p.label,
      shape: f as Feature<Polygon | MultiPolygon>,
    });
  }
  return countries;
}
