"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Browser cart-summary store.
 *
 * The shared site header is statically rendered, so it cannot read the cart
 * cookie without making every public page dynamic. The header therefore renders
 * the cart icon with no count and this store fills it in afterwards from
 * `/api/cart/summary`, which reads the cookie server-side.
 *
 * It is a single module-level store rather than one fetch per icon: the desktop
 * bar and the mobile drawer both render a cart icon, and a page that contained
 * two islands each fetching would double the requests for one value.
 *
 * Add-to-cart publishes the action's returned count through `setCartSummary`, so
 * the badge updates immediately without waiting for the next fetch; the next
 * navigation re-fetches from the server, which is what resets it after checkout.
 */
export type CartSummary = { itemCount: number; href: string | null };

let summary: CartSummary | null = null;
let requestedFor: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Publish a summary the browser already knows (an add-to-cart result).
 *
 * The href is left untouched unless one is supplied: adding an item does not
 * change where the cart lives, and the server path is the authoritative one.
 */
export function setCartSummary(next: {
  itemCount: number;
  href?: string | null;
}): void {
  const itemCount =
    Number.isFinite(next.itemCount) && next.itemCount > 0
      ? Math.trunc(next.itemCount)
      : 0;
  summary = { itemCount, href: next.href ?? summary?.href ?? null };
  emit();
}

/**
 * Fetch the summary once per (locale, route), and again on a route change.
 *
 * The key guard is what keeps a page with two cart icons — the desktop bar and
 * the mobile drawer — from issuing two requests, and what makes a navigation
 * refresh the value (checkout empties the cart, so the confirmation page must not
 * show the pre-checkout count).
 */
export function requestCartSummary(locale: string, pathname: string): void {
  // `fetch` is absent in some test environments and in a very old browser; the
  // badge simply stays hidden there rather than throwing during render.
  if (typeof fetch !== "function") return;

  const key = `${locale}:${pathname}`;
  if (requestedFor === key) return;
  requestedFor = key;

  void fetch(`/api/cart/summary?locale=${encodeURIComponent(locale)}`, {
    headers: { accept: "application/json" },
    credentials: "same-origin",
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: unknown) => {
      if (
        data &&
        typeof data === "object" &&
        "itemCount" in data &&
        typeof (data as { itemCount: unknown }).itemCount === "number"
      ) {
        const record = data as { itemCount: number; href?: unknown };
        summary = {
          itemCount: Math.max(0, Math.trunc(record.itemCount)),
          href:
            typeof record.href === "string" ? record.href : summary?.href ?? null,
        };
        emit();
      }
    })
    .catch(() => {
      // A failed fetch leaves the badge hidden rather than showing a wrong count.
      // Clearing the key lets the next mount retry the request.
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
 * The current summary, or `null` before the first fetch resolves.
 *
 * The server snapshot is `null` because there is no cart information during SSR
 * — the header island renders the same empty icon on the server and on the first
 * client render, so there is no hydration mismatch.
 */
export function useCartSummary(
  locale: string,
  pathname: string,
): CartSummary | null {
  useEffect(() => {
    requestCartSummary(locale, pathname);
  }, [locale, pathname]);

  return useSyncExternalStore(
    subscribe,
    () => summary,
    () => null,
  );
}
