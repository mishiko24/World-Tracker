// Phone layout switch. Must match the @media (max-width: 700px) block in styles.css.

import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 700px)";
const mediaQuery = window.matchMedia(MOBILE_QUERY);

export function isMobileNow(): boolean {
  return mediaQuery.matches;
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
