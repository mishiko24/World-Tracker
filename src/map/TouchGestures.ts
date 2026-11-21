// Touch gestures for the map, built from pointer events whose pointerType is "touch".
//
//   one finger drag  -> pan
//   two fingers      -> pinch zoom around the midpoint, and pan with the midpoint
//   tap              -> tap(x, y)
//   long press       -> longPress(x, y), when one finger stays still for LONG_PRESS_MS
//
// A gesture can only end in a tap while it is one finger that hasn't moved and hasn't long-pressed.
// Coordinates are CSS pixels relative to the canvas (offsetX/offsetY).

const TAP_MAX_MOVE_PX = 10; // fingers wobble more than a mouse
const LONG_PRESS_MS = 500;

export interface TouchHandlers {
  pan: (dx: number, dy: number) => void;
  zoomBy: (factor: number, x: number, y: number) => void;
  tap: (x: number, y: number) => void;
  longPress: (x: number, y: number) => void;
}

interface Point {
  x: number;
  y: number;
}

export class TouchGestures {
  private readonly handlers: TouchHandlers;
  private readonly touches = new Map<number, Point>(); // pointerId -> last position
  private startX = 0;
  private startY = 0;
  private couldBeTap = false;
  private longPressTimer = 0;

  constructor(handlers: TouchHandlers) {
    this.handlers = handlers;
  }

  // True while a finger is on the screen.
  get active(): boolean {
    return this.touches.size > 0;
  }

  down(e: PointerEvent): void {
    this.touches.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    this.cancelLongPress();
    if (this.touches.size === 1) {
      this.startX = e.offsetX;
      this.startY = e.offsetY;
      this.couldBeTap = true;
      this.longPressTimer = window.setTimeout(() => {
        this.couldBeTap = false;
        this.handlers.longPress(this.startX, this.startY);
      }, LONG_PRESS_MS);
    } else {
      this.couldBeTap = false;
    }
  }

  move(e: PointerEvent): void {
    const previous = this.touches.get(e.pointerId);
    if (previous === undefined) {
      return;
    }
    const next = { x: e.offsetX, y: e.offsetY };

    if (this.touches.size === 1) {
      if (this.couldBeTap && Math.hypot(next.x - this.startX, next.y - this.startY) <= TAP_MAX_MOVE_PX) {
        return; // still within tap wobble: don't pan yet
      }
      this.couldBeTap = false;
      this.cancelLongPress();
      this.handlers.pan(next.x - previous.x, next.y - previous.y);
      this.touches.set(e.pointerId, next);
      return;
    }

    // Two (or more) fingers: use the first two.
    const [a, b] = [...this.touches.values()];
    const before = pinchOf(a, b);
    this.touches.set(e.pointerId, next);
    const [a2, b2] = [...this.touches.values()];
    const after = pinchOf(a2, b2);
    this.handlers.pan(after.x - before.x, after.y - before.y);
    if (before.distance > 0) {
      this.handlers.zoomBy(after.distance / before.distance, after.x, after.y);
    }
  }

  up(e: PointerEvent): void {
    if (!this.touches.delete(e.pointerId)) {
      return;
    }
    if (this.touches.size === 0) {
      this.cancelLongPress();
      if (this.couldBeTap) {
        this.handlers.tap(this.startX, this.startY);
      }
    }
  }

  // The browser took the touch over (e.g. a system gesture): end it without a tap.
  cancel(e: PointerEvent): void {
    this.touches.delete(e.pointerId);
    this.couldBeTap = false;
    this.cancelLongPress();
  }

  private cancelLongPress(): void {
    window.clearTimeout(this.longPressTimer);
  }
}

function pinchOf(a: Point, b: Point): { x: number; y: number; distance: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}
