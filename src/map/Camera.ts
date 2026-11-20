// Maps world space (see geo.ts) to screen pixels.
// x wraps forever; y is clamped so the map never leaves the top/bottom of the screen.

import { WORLD_BOTTOM, WORLD_HEIGHT, WORLD_TOP, WORLD_WIDTH } from "./geo";

export const MIN_ZOOM = 1; // world height exactly fills the viewport height
export const MAX_ZOOM = 40;

export class Camera {
  x = WORLD_WIDTH / 2; // world point at the center of the viewport
  y = (WORLD_TOP + WORLD_BOTTOM) / 2;
  zoom = MIN_ZOOM;
  viewWidth = 1; // CSS pixels
  viewHeight = 1;

  // Screen pixels per world unit.
  scale(): number {
    return (this.viewHeight / WORLD_HEIGHT) * this.zoom;
  }

  setViewSize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.clamp();
  }

  screenToWorldX(screenX: number): number {
    return this.x + (screenX - this.viewWidth / 2) / this.scale();
  }

  screenToWorldY(screenY: number): number {
    return this.y + (screenY - this.viewHeight / 2) / this.scale();
  }

  // Screen x of a world x, for the world copy shifted by `copy` widths.
  worldToScreenX(worldX: number, copy: number): number {
    return (worldX + copy * WORLD_WIDTH - this.x) * this.scale() + this.viewWidth / 2;
  }

  worldToScreenY(worldY: number): number {
    return (worldY - this.y) * this.scale() + this.viewHeight / 2;
  }

  panByScreen(dx: number, dy: number): void {
    this.x -= dx / this.scale();
    this.y -= dy / this.scale();
    this.clamp();
  }

  // Sets zoom while keeping the world point under (screenX, screenY) in place.
  zoomAt(screenX: number, screenY: number, zoom: number): void {
    const worldX = this.screenToWorldX(screenX);
    const worldY = this.screenToWorldY(screenY);
    this.zoom = clampZoom(zoom);
    this.x = worldX - (screenX - this.viewWidth / 2) / this.scale();
    this.y = worldY - (screenY - this.viewHeight / 2) / this.scale();
    this.clamp();
  }

  // Centers on a world point and zooms so a box of the given world size fits in about 60% of the view.
  focus(centerX: number, centerY: number, width: number, height: number, maxZoom: number): void {
    const fitScale = Math.min((this.viewWidth * 0.6) / width, (this.viewHeight * 0.6) / height);
    this.zoom = clampZoom(Math.min(fitScale / (this.viewHeight / WORLD_HEIGHT), maxZoom));
    this.x = centerX;
    this.y = centerY;
    this.clamp();
  }

  private clamp(): void {
    this.zoom = clampZoom(this.zoom);

    // Keep x in one world width so it never drifts into huge numbers.
    this.x = ((this.x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;

    const halfVisibleHeight = this.viewHeight / 2 / this.scale();
    const minY = WORLD_TOP + halfVisibleHeight;
    const maxY = WORLD_BOTTOM - halfVisibleHeight;
    if (minY > maxY) {
      this.y = (WORLD_TOP + WORLD_BOTTOM) / 2;
    } else {
      this.y = Math.min(Math.max(this.y, minY), maxY);
    }
  }
}

export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
}
