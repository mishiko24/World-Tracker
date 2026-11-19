// Draws Web-Mercator raster tiles (z/x/y, 256 px) under the countries.
//
// World space (geo.ts) is the same Mercator as web tiles, so tile (z, x, y) covers
// world x in [x, x+1] * WORLD_WIDTH / 2^z, and the same for y. No reprojection needed.
//
// While a tile loads, the closest loaded ancestor tile is drawn stretched in its place.

import type { Camera } from "./Camera";
import { WORLD_WIDTH } from "./geo";

export interface TileSource {
  url: (z: number, x: number, y: number) => string;
  maxZoom: number;
  attribution: string;
}

const TILE_PIXELS = 256;
const MAX_CACHED_TILES = 500;

interface Tile {
  image: HTMLImageElement;
  loaded: boolean;
  lastUsedFrame: number;
}

export class TileLayer {
  private readonly source: TileSource;
  private readonly onTileLoaded: () => void;
  private readonly cache = new Map<string, Tile>();
  private frame = 0;

  constructor(source: TileSource, onTileLoaded: () => void) {
    this.source = source;
    this.onTileLoaded = onTileLoaded;

    // Levels 0-2 (21 tiles) are loaded up front so there is always some ancestor to fall back on.
    for (let z = 0; z <= Math.min(2, source.maxZoom); z++) {
      for (let y = 0; y < 2 ** z; y++) {
        for (let x = 0; x < 2 ** z; x++) {
          this.getOrRequest(z, x, y);
        }
      }
    }
  }

  // Expects ctx to have an identity transform (device pixels).
  draw(ctx: CanvasRenderingContext2D, camera: Camera, dpr: number): void {
    this.frame++;
    const scale = camera.scale();

    // Pick the tile level whose tiles show at ~180-360 device px. Rounding (instead of ceil) roughly
    // halves the tile requests while zooming, at the cost of up to 1.4x upscaling.
    const worldWidthDevicePx = WORLD_WIDTH * scale * dpr;
    const z = Math.min(Math.max(Math.round(Math.log2(worldWidthDevicePx / TILE_PIXELS)), 0), this.source.maxZoom);
    const tilesPerSide = 2 ** z;
    const tileWorld = WORLD_WIDTH / tilesPerSide;

    const firstX = Math.floor(camera.screenToWorldX(0) / tileWorld);
    const lastX = Math.floor(camera.screenToWorldX(camera.viewWidth) / tileWorld);
    const firstY = Math.max(Math.floor(camera.screenToWorldY(0) / tileWorld), 0);
    const lastY = Math.min(Math.floor(camera.screenToWorldY(camera.viewHeight) / tileWorld), tilesPerSide - 1);

    for (let ty = firstY; ty <= lastY; ty++) {
      for (let tx = firstX; tx <= lastX; tx++) {
        // Snap edges to whole device pixels so neighbouring tiles never leave hairline gaps.
        const left = Math.floor(camera.worldToScreenX(tx * tileWorld, 0) * dpr);
        const right = Math.floor(camera.worldToScreenX((tx + 1) * tileWorld, 0) * dpr);
        const top = Math.floor(camera.worldToScreenY(ty * tileWorld) * dpr);
        const bottom = Math.floor(camera.worldToScreenY((ty + 1) * tileWorld) * dpr);
        const wrappedX = ((tx % tilesPerSide) + tilesPerSide) % tilesPerSide;
        this.drawTileOrAncestor(ctx, z, wrappedX, ty, left, top, right - left, bottom - top);
      }
    }

    this.evictOldTiles();
  }

  private drawTileOrAncestor(
    ctx: CanvasRenderingContext2D,
    z: number,
    x: number,
    y: number,
    left: number,
    top: number,
    width: number,
    height: number,
  ): void {
    const tile = this.getOrRequest(z, x, y);
    if (tile.loaded) {
      ctx.drawImage(tile.image, left, top, width, height);
      return;
    }

    // Walk up the pyramid until a loaded ancestor is found; draw the part of it that covers this tile.
    for (let up = 1; up <= z; up++) {
      const ancestor = this.cache.get(tileKey(z - up, x >> up, y >> up));
      if (ancestor === undefined || !ancestor.loaded) {
        continue;
      }
      ancestor.lastUsedFrame = this.frame;
      const part = TILE_PIXELS / 2 ** up;
      const sourceX = (x % 2 ** up) * part;
      const sourceY = (y % 2 ** up) * part;
      ctx.drawImage(ancestor.image, sourceX, sourceY, part, part, left, top, width, height);
      return;
    }
  }

  private getOrRequest(z: number, x: number, y: number): Tile {
    const key = tileKey(z, x, y);
    let tile = this.cache.get(key);
    if (tile === undefined) {
      const image = new Image();
      image.crossOrigin = "anonymous"; // keeps the canvas readable (pixel tests, future screenshot export)
      const newTile: Tile = { image, loaded: false, lastUsedFrame: this.frame };
      image.onload = () => {
        newTile.loaded = true;
        this.onTileLoaded();
      };
      image.onerror = () => {
        console.error(`Tile failed to load: ${image.src}`);
      };
      image.src = this.source.url(z, x, y);
      this.cache.set(key, newTile);
      tile = newTile;
    }
    tile.lastUsedFrame = this.frame;
    return tile;
  }

  // Drops the least recently drawn tiles once the cache is too big. Level 0-2 tiles stay forever as fallbacks.
  private evictOldTiles(): void {
    if (this.cache.size <= MAX_CACHED_TILES) {
      return;
    }
    const entries = [...this.cache.entries()].filter(([key]) => Number(key.split("/")[0]) > 2);
    entries.sort((a, b) => a[1].lastUsedFrame - b[1].lastUsedFrame);
    const removeCount = this.cache.size - MAX_CACHED_TILES;
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      const [key, tile] = entries[i];
      if (tile.lastUsedFrame === this.frame) {
        break; // everything after this is on screen right now
      }
      tile.image.onload = null;
      tile.image.onerror = null;
      tile.image.src = ""; // cancels the download if it's still in flight
      this.cache.delete(key);
    }
  }
}

function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}
