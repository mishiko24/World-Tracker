// One country's outline drawn on its own, filling a box: share cards and the outline quiz (src/game).
// Projected around the country's own longitude, so Russia and Fiji stay in one piece across the date line.
// Parts further than MAINLAND_RADIUS_DEGREES from the label point are left out (France without French Guiana,
// the US without Hawaii), otherwise the mainland would be a speck.

import { geoDistance, geoMercator, geoPath } from "d3-geo";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import type { Country } from "../map/geo";

const MAINLAND_RADIUS_DEGREES = 40;

export function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  country: Country,
  fill: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const shape = mainland(country.shape, country.label);
  const projection = geoMercator()
    .rotate([-country.label[0], 0])
    .fitExtent(
      [
        [x, y],
        [x + w, y + h],
      ],
      shape,
    );
  ctx.beginPath();
  geoPath(projection, ctx)(shape);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.stroke();
}

function mainland(shape: Feature<Polygon | MultiPolygon>, label: [number, number]): Feature<MultiPolygon> {
  const polygons = shape.geometry.type === "Polygon" ? [shape.geometry.coordinates] : shape.geometry.coordinates;
  const radians = (MAINLAND_RADIUS_DEGREES * Math.PI) / 180;
  const near = polygons.filter((polygon) => polygon[0].some((p: Position) => geoDistance(p as [number, number], label) <= radians));
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: near.length > 0 ? near : polygons } };
}
