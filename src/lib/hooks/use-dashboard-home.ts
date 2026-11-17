"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Browser store for "which dashboard does this visitor belong to".
 *
 * The shared site header is statically rendered, so it cannot read the session to
 * decide whether to offer a return-to-dashboard control; doing so would call
 * `cookies()` in the shared layout and make every public page dynamic, costing the
 * prerendered HTML the SEO requirements depend on. The header therefore renders
 * its static markup and this store asks `/api/account/dashboard` afterwards, the
 * same split `/api/cart/summary` uses for the cart badge.
 *
 * It is one module-level store rather than one fetch per island: the desktop bar
 * and the mobile drawer both render the control, and two islands each fetching
 * would double the requests for one value. The key guard also refreshes the answer
 * on a navigation, which is what clears the control after a sign-out.
 */
export type DashboardHome = { href: string; labelKey: string };

let home: DashboardHome | null = null;
let requestedFor: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function requestDashboardHome(locale: string, pathname: string): void {
  // `fetch` is absent in some test environments and in a very old browser; the
  // control simply stays hidden there rather than throwing during render.
  if (typeof fetch !== "function") return;

  const key = `${locale}:${pathname}`;
  if (requestedFor === key) return;
  requestedFor = key;

  void fetch(`/api/account/dashboard?locale=${encodeURIComponent(locale)}`, {
    headers: { accept: "application/json" },
    credentials: "same-origin",
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: unknown) => {
      if (data && typeof data === "object" && "href" in data) {
        const record = data as { href?: unknown; labelKey?: unknown };
        if (
          typeof record.href === "string" &&
          typeof record.labelKey === "string"
        ) {
          home = { href: record.href, labelKey: record.labelKey };
          emit();
          return;
        }
      }
      // A signed-out caller (or one with no dashboard) gets `null`, which clears
      // any value left over from an earlier signed-in render.
      home = null;
      emit();
    })
    .catch(() => {
      // A failed fetch leaves the control hidden rather than showing a link that
      // may not resolve. Clearing the key lets the next mount retry.
      requestedFor = null;
    });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * The caller's dashboard, or `null`.
 *
 * The server snapshot is `null` because there is no session information during
 * SSR — the header island renders nothing on the server and on the first client
 * render, so there is no hydration mismatch.
 */
export function useDashboardHome(
  locale: string,
  pathname: string,
): DashboardHome | null {
  useEffect(() => {
    requestDashboardHome(locale, pathname);
  }, [locale, pathname]);

  return useSyncExternalStore(
    subscribe,
    () => home,
    () => null,
  );
}
