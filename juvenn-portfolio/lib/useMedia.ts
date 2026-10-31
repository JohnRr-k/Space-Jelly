"use client";

import { useSyncExternalStore } from "react";

/** Subscribes to a CSS media query. Always `false` on the server and during hydration. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True when the page is opened straight from disk (file://), e.g. the single-file build. */
export function useIsFile(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.protocol === "file:",
    () => false,
  );
}
