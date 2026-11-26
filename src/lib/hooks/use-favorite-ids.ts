"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { FavoriteEntityType } from "@/lib/favorites/types";

/**
 * Browser favourite-id store.
 *
 * The store and insights pages are statically rendered, so they cannot read the
 * session cookie without becoming dynamic. The heart controls therefore render
 * their default state on the server and this store fills them from
 * `/api/favorites/summary` after hydration.
 *
 * It is one module-level store rather than one fetch per card: a page can render
 * dozens of hearts, and each one calling the endpoint would be dozens of requests
 * for the same answer. The first mount requests; every later mount reuses the
 * result until a toggle forces a refresh.
 */
type FavoriteSummary = {
  listing: ReadonlySet<string>;
  product: ReadonlySet<string>;
  insight: ReadonlySet<string>;
};

let summary: FavoriteSummary | null = null;
let requested = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function asIdSet(value: unknown): ReadonlySet<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value.filter((entry): entry is string => typeof entry === "string"),
  );
}

function parseSummary(data: unknown): FavoriteSummary {
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    listing: asIdSet(record.listing),
    product: asIdSet(record.product),
    insight: asIdSet(record.insight),
  };
}

/**
 * Fetch the summary once, or force a refresh after a toggle.
 *
 * `fetch` is absent in some test environments; the hearts keep their server
 * default there rather than throwing during render.
 */
export function requestFavoriteSummary(force = false): Promise<void> {
  if (typeof fetch !== "function") return Promise.resolve();
  if (!force && (requested || inFlight)) {
    return inFlight ?? Promise.resolve();
  }

  requested = true;
  inFlight = fetch("/api/favorites/summary", {
    headers: { accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: unknown) => {
      if (!data) return;
      summary = parseSummary(data);
      emit();
    })
    .catch(() => {
      // A failed fetch leaves the hearts at their server default. Clearing the
      // guard lets the next mount retry.
      requested = false;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * The saved ids for one entity type, or `null` before the first fetch resolves.
 *
 * The server snapshot is `null` so the first client render matches the HTML; the
 * caller falls back to the saved state it was rendered with.
 */
export function useFavoriteIds(
  entityType: FavoriteEntityType,
): ReadonlySet<string> | null {
  useEffect(() => {
    void requestFavoriteSummary();
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => (summary ? summary[entityType] : null),
    () => null,
  );
}
