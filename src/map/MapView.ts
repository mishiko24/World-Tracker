// The map: draws countries on a canvas and handles mouse input.
//
// Controls:
//   hover            -> highlight country
//   left click       -> select country; click on ocean deselects; a drag is never a click
//   right drag       -> pan (horizontal wraps forever, vertical is clamped)
//   wheel            -> zoom toward cursor, smoothed
//   Esc              -> deselect
//
// The view only redraws when something changed (`dirty`).

import { Camera, clampZoom } from "./Camera";
import { WORLD_WIDTH, type Country } from "./geo";
import { getMapType } from "./mapTypes";
import { TileLayer } from "./TileLayer";
import type { CountryState, MapStyle, Settings, StateStyle } from "../settings";

const CLICK_MAX_MOVE_PX = 5; // left button moving more than this between down and up is a drag, not a click
const WHEEL_PIXELS_PER_NOTCH = 100; // typical deltaY of one mouse-wheel notch
const MAX_ZOOM_GLIDE_SECONDS = 0.3; // zoom smoothness 1 = this time constant

// Countries smaller than this on screen also get a dot, so microstates stay visible and clickable.
const DOT_SHOW_BELOW_PX = 6;
const DOT_RADIUS_PX = 3.5;
const DOT_HIT_RADIUS_PX = 7;

export class MapView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hitCtx: CanvasRenderingContext2D; // untransformed context, only used for isPointInPath
  private readonly camera = new Camera();
  private readonly countries: Country[];
  private readonly onSelect: (id: string | null) => void;
  private readonly resizeObserver: ResizeObserver;

  private settings: Settings;
  private tileLayer: TileLayer | null = null; // imagery under the countries, for map types that have it
  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  private dirty = true;

  private targetZoom = 1;
  private zoomAnchorX = 0;
  private zoomAnchorY = 0;

  private pointerInside = false;
  private pointerX = 0;
  private pointerY = 0;
  private panning = false;
  private leftDown = false;
  private leftDownX = 0;
  private leftDownY = 0;

  private frameHandle = 0;
  private lastFrameTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    countries: Country[],
    settings: Settings,
    onSelect: (id: string | null) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.hitCtx = document.createElement("canvas").getContext("2d")!;
    this.countries = countries;
    this.settings = settings;
    this.tileLayer = this.createTileLayer();
    this.onSelect = onSelect;

    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
    canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.handleContextMenu);
    window.addEventListener("keydown", this.handleKeyDown);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(canvas);
    this.resize();

    this.frameHandle = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  setSettings(settings: Settings): void {
    const mapTypeChanged = settings.mapType !== this.settings.mapType;
    this.settings = settings;
    if (mapTypeChanged) {
      this.tileLayer = this.createTileLayer();
    }
    this.dirty = true;
  }

  private createTileLayer(): TileLayer | null {
    const tiles = getMapType(this.settings.mapType).tiles;
    if (tiles === null) {
      return null;
    }
    return new TileLayer(tiles, () => {
      this.dirty = true;
    });
  }

  private style(): MapStyle {
    return this.settings.styles[this.settings.mapType];
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.dirty = true;
  }

  // ---------- frame loop ----------

  private frame = (time: number): void => {
    const dt = this.lastFrameTime === 0 ? 0 : (time - this.lastFrameTime) / 1000;
    this.lastFrameTime = time;

    this.stepZoom(dt);
    if (this.dirty) {
      this.dirty = false;
      this.draw();
    }
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  // Moves the current zoom toward targetZoom. Exponential glide in log space, so every step feels the same.
  private stepZoom(dt: number): void {
    const current = this.camera.zoom;
    if (current === this.targetZoom) {
      return;
    }
    const glideSeconds = this.settings.zoomSmoothness * MAX_ZOOM_GLIDE_SECONDS;
    let next = this.targetZoom;
    if (glideSeconds > 0) {
      const t = 1 - Math.exp(-dt / glideSeconds);
      next = current * Math.pow(this.targetZoom / current, t);
      if (Math.abs(Math.log(this.targetZoom / next)) < 0.001) {
        next = this.targetZoom;
      }
    }
    this.camera.zoomAt(this.zoomAnchorX, this.zoomAnchorY, next);
    this.cameraMoved();
  }

  private cameraMoved(): void {
    this.dirty = true;
    if (this.pointerInside && !this.panning) {
      this.setHovered(this.hitTest(this.pointerX, this.pointerY));
    }
  }

  // ---------- drawing ----------

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.camera.setViewSize(rect.width, rect.height);
    this.dirty = true;
  }

  private stateOf(country: Country): CountryState {
    if (country.id === this.selectedId) {
      return "selected";
    }
    if (country.id === this.hoveredId) {
      return "highlighted";
    }
    return "default";
  }

  private draw(): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const dpr = window.devicePixelRatio;
    const scale = cam.scale();

    const mapStyle = this.style();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = mapStyle.oceanColor;
    ctx.fillRect(0, 0, cam.viewWidth, cam.viewHeight);

    if (this.tileLayer !== null) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.tileLayer.draw(ctx, cam, dpr);
    }

    // Visible world rectangle (x not wrapped).
    const left = cam.screenToWorldX(0);
    const right = cam.screenToWorldX(cam.viewWidth);
    const top = cam.screenToWorldY(0);
    const bottom = cam.screenToWorldY(cam.viewHeight);
    const firstCopy = Math.floor(left / WORLD_WIDTH);
    const lastCopy = Math.floor(right / WORLD_WIDTH);

    // Default countries first, then highlighted, then selected, so their outlines sit on top.
    const states: CountryState[] = ["default", "highlighted", "selected"];
    for (const state of states) {
      const style = mapStyle[state];
      for (let copy = firstCopy; copy <= lastCopy; copy++) {
        const offset = copy * WORLD_WIDTH;
        ctx.setTransform(
          scale * dpr, 0, 0, scale * dpr,
          cam.worldToScreenX(0, copy) * dpr,
          cam.worldToScreenY(0) * dpr,
        );
        for (const country of this.countries) {
          if (this.stateOf(country) !== state) {
            continue;
          }
          const outsideView =
            country.maxX + offset < left ||
            country.minX + offset > right ||
            country.maxY < top ||
            country.minY > bottom;
          if (outsideView) {
            continue;
          }
          this.drawCountryShape(country, style, scale);
        }
      }
      this.drawDots(state, style, scale, firstCopy, lastCopy);
    }
  }

  private drawCountryShape(country: Country, style: StateStyle, scale: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = toRgba(style.fillColor, style.fillOpacity);
    ctx.fill(country.fillPath, "evenodd");
    if (style.outlineWidth > 0) {
      ctx.strokeStyle = toRgba(style.outlineColor, style.outlineOpacity);
      ctx.lineWidth = style.outlineWidth / scale; // keep outline width constant in screen pixels
      ctx.lineJoin = "round";
      ctx.stroke(country.outlinePath);
    }
  }

  private drawDots(state: CountryState, style: StateStyle, scale: number, firstCopy: number, lastCopy: number): void {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = toRgba(style.fillColor, style.fillOpacity);
    ctx.strokeStyle = toRgba(style.outlineColor, style.outlineOpacity);
    ctx.lineWidth = style.outlineWidth;
    for (const country of this.countries) {
      if (country.size * scale >= DOT_SHOW_BELOW_PX || this.stateOf(country) !== state) {
        continue;
      }
      const y = this.camera.worldToScreenY(country.labelY);
      for (let copy = firstCopy; copy <= lastCopy; copy++) {
        const x = this.camera.worldToScreenX(country.labelX, copy);
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS_PX, 0, Math.PI * 2);
        ctx.fill();
        if (style.outlineWidth > 0) {
          ctx.stroke();
        }
      }
    }
  }

  // ---------- hit testing ----------

  // Returns the id of the country under a screen point, or null for ocean.
  private hitTest(screenX: number, screenY: number): string | null {
    const cam = this.camera;
    const scale = cam.scale();

    // Dots are drawn on top, so test them first. Pick the closest one in range.
    let closestDotId: string | null = null;
    let closestDotDistance = DOT_HIT_RADIUS_PX;
    const pointerWorldX = cam.screenToWorldX(screenX);
    for (const country of this.countries) {
      if (country.size * scale >= DOT_SHOW_BELOW_PX) {
        continue;
      }
      const wrappedDx = wrapSigned(country.labelX - pointerWorldX);
      const dx = wrappedDx * scale;
      const dy = cam.worldToScreenY(country.labelY) - screenY;
      const distance = Math.hypot(dx, dy);
      if (distance <= closestDotDistance) {
        closestDotDistance = distance;
        closestDotId = country.id;
      }
    }
    if (closestDotId !== null) {
      return closestDotId;
    }

    const x = ((pointerWorldX % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
    const y = cam.screenToWorldY(screenY);
    for (const country of this.countries) {
      if (x < country.minX || x > country.maxX || y < country.minY || y > country.maxY) {
        continue;
      }
      if (this.hitCtx.isPointInPath(country.fillPath, x, y, "evenodd")) {
        return country.id;
      }
    }
    return null;
  }

  private setHovered(id: string | null): void {
    if (id !== this.hoveredId) {
      this.hoveredId = id;
      this.dirty = true;
    }
    this.updateCursor();
  }

  private updateCursor(): void {
    if (this.panning) {
      this.canvas.style.cursor = "grabbing";
    } else if (this.hoveredId !== null) {
      this.canvas.style.cursor = "pointer";
    } else {
      this.canvas.style.cursor = "default";
    }
  }

  // ---------- input ----------

  private handlePointerDown = (e: PointerEvent): void => {
    if (e.button === 2) {
      this.panning = true;
      this.pointerX = e.offsetX;
      this.pointerY = e.offsetY;
      this.canvas.setPointerCapture(e.pointerId);
      this.setHovered(null);
    } else if (e.button === 0) {
      this.leftDown = true;
      this.leftDownX = e.offsetX;
      this.leftDownY = e.offsetY;
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const dx = e.offsetX - this.pointerX;
    const dy = e.offsetY - this.pointerY;
    this.pointerInside = true;
    this.pointerX = e.offsetX;
    this.pointerY = e.offsetY;

    if (this.panning) {
      this.camera.panByScreen(dx, dy);
      this.dirty = true;
    } else {
      this.setHovered(this.hitTest(e.offsetX, e.offsetY));
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.button === 2 && this.panning) {
      this.panning = false;
      this.canvas.releasePointerCapture(e.pointerId);
      this.setHovered(this.hitTest(e.offsetX, e.offsetY));
    } else if (e.button === 0 && this.leftDown) {
      this.leftDown = false;
      const moved = Math.hypot(e.offsetX - this.leftDownX, e.offsetY - this.leftDownY);
      if (moved <= CLICK_MAX_MOVE_PX) {
        this.select(this.hitTest(e.offsetX, e.offsetY));
      }
    }
  };

  private handlePointerLeave = (): void => {
    this.pointerInside = false;
    if (!this.panning) {
      this.setHovered(null);
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    let pixels = e.deltaY;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      pixels *= 40;
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      pixels *= 800;
    }
    const notches = pixels / WHEEL_PIXELS_PER_NOTCH;
    const factor = Math.pow(1 + this.settings.zoomAmount, -notches);
    this.targetZoom = clampZoom(this.targetZoom * factor);
    this.zoomAnchorX = e.offsetX;
    this.zoomAnchorY = e.offsetY;
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      this.select(null);
    }
  };

  private select(id: string | null): void {
    if (id === this.selectedId) {
      return;
    }
    this.setSelected(id);
    this.onSelect(id);
  }
}

// Wraps a world-x difference into [-WORLD_WIDTH/2, WORLD_WIDTH/2).
function wrapSigned(dx: number): number {
  return ((((dx + WORLD_WIDTH / 2) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH) - WORLD_WIDTH / 2;
}

function toRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
