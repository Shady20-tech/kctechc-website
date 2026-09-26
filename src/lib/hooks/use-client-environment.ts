"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-only environment hooks.
 *
 * Both values are genuinely external state — the browser's motion preference and
 * `localStorage` — so they are read with `useSyncExternalStore` rather than an
 * effect that calls `setState`. That avoids a cascading render on mount and gives
 * React a defined server snapshot instead of an undefined-then-set flip.
 *
 * The server snapshots are deliberately conservative: motion is treated as
 * reduced and no stored value exists. Both enhancements therefore render nothing
 * (or nothing animated) in the initial HTML and only appear once the browser
 * value is known, which is the correct behaviour for additive features.
 */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    // No media information exists during SSR, so assume reduced motion and leave
    // the animated enhancement off for the first paint.
    () => true,
  );
}

/**
 * Read a string from `localStorage` without a mount-time `setState`.
 *
 * `getItem` returns a primitive, so the snapshot is stable by value and React's
 * `Object.is` comparison behaves correctly without an explicit cache.
 */
export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      // `storage` fires for other tabs; re-reading on subscribe covers the common
      // case of returning to a page in the same tab.
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}
