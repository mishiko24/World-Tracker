// Layout switches. Must match the @media blocks at the end of styles.css.
//   mobile  (max-width: 700px)                    phones upright: bottom-sheet info panel, full-screen settings
//   compact mobile, or (max-height: 500px)        also phones sideways: settings start closed (full-screen drawer);
//                                                 the info panel stays a side panel, slimmer

import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 700px)";
const mediaQuery = window.matchMedia(MOBILE_QUERY);

const COMPACT_QUERY = "(max-width: 700px), (max-height: 500px)";

export function isMobileNow(): boolean {
  return mediaQuery.matches;
}

export function isCompactNow(): boolean {
  return window.matchMedia(COMPACT_QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  mediaQuery.addEventListener("change", onChange);
  return () => {
    mediaQuery.removeEventListener("change", onChange);
  };
}

export function useMobile(): boolean {
  return useSyncExternalStore(subscribe, isMobileNow);
}
