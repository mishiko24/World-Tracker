// Phone layout: the info panel is a bottom sheet with three heights (snaps).
//   peek = country name + Power Level score, half = half the screen, full = almost the whole screen.
// Drag the header to resize (it snaps to the nearest height on release); tap the header to toggle peek <-> half.
// Snap heights live in styles.css (.sheet-peek / .sheet-half / .sheet-full); while dragging, an inline height wins.
// On desktop the hook still runs but the CSS ignores the snap classes and the header handlers do nothing.

import { useRef, useState, type PointerEvent } from "react";

export type SheetSnap = "peek" | "half" | "full";

const TAP_MAX_MOVE_PX = 6;
const MIN_HEIGHT_PX = 100;
const TOP_GAP_PX = 64; // full sheet leaves the menu button and search visible

// Must match styles.css.
function snapHeights(): Record<SheetSnap, number> {
  return { peek: 172, half: window.innerHeight * 0.5, full: window.innerHeight - TOP_GAP_PX };
}

export function useBottomSheet(enabled: boolean) {
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (!enabled || (e.target as HTMLElement).closest("button") !== null) {
      return; // header buttons keep working normally
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const sheet = e.currentTarget.closest("aside")!;
    drag.current = { startY: e.clientY, startHeight: sheet.getBoundingClientRect().height, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (d === null) {
      return;
    }
    const dy = d.startY - e.clientY;
    if (!d.moved && Math.abs(dy) <= TAP_MAX_MOVE_PX) {
      return;
    }
    d.moved = true;
    setDragHeight(Math.min(Math.max(d.startHeight + dy, MIN_HEIGHT_PX), snapHeights().full));
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (d === null) {
      return;
    }
    drag.current = null;
    if (!d.moved) {
      setSnap(snap === "peek" ? "half" : "peek");
      return;
    }
    const height = d.startHeight + (d.startY - e.clientY);
    const heights = snapHeights();
    const nearest = (Object.keys(heights) as SheetSnap[]).reduce((best, s) =>
      Math.abs(heights[s] - height) < Math.abs(heights[best] - height) ? s : best,
    );
    setSnap(nearest);
    setDragHeight(null);
  }

  return {
    snap,
    setSnap,
    className: `sheet-${snap}${dragHeight !== null ? " sheet-dragging" : ""}`,
    style: dragHeight !== null ? { height: dragHeight } : undefined,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
