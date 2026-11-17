"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Browser store for the header's account controls.
 *
 * The shared site header is statically rendered, so it cannot read the session to
 * decide whether to show "Sign in", an account icon or a return-to-dashboard
 * link; doing so would call `cookies()` in the shared layout and make every public
 * page dynamic, costing the prerendered HTML the SEO requirements depend on. The
 * header therefore renders its signed-out markup and this store asks
 * `/api/account/summary` afterwards, the same split the cart badge uses.
 *
 * It is one module-level store rather than one fetch per island: the desktop bar
 * and the mobile drawer both render the account control, and two islands each
 * fetching would double the requests for one answer. The key guard also refreshes
 * the answer on a navigation, which is what clears the avatar and the return link
 * after a sign-out.
 */
export type AccountSummary = {
  signedIn: boolean;
  accountHref: string;
  name: string;
  avatarUrl: string | null;
  dashboard: { href: string; labelKey: string } | null;
};

let summary: AccountSummary | null = null;
let requestedFor: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function isSummary(value: unknown): value is AccountSummary {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.signedIn === "boolean" &&
    typeof record.accountHref === "string" &&
    typeof record.name === "string" &&
    (record.avatarUrl === null || typeof record.avatarUrl === "string")
  );
}

function requestAccountSummary(locale: string, pathname: string): void {
  // `fetch` is absent in some test environments and in a very old browser; the
  // control simply renders its signed-out state there rather than throwing.
  if (typeof fetch !== "function") return;

  const key = `${locale}:${pathname}`;
  if (requestedFor === key) return;
  requestedFor = key;

  void fetch(`/api/account/summary?locale=${encodeURIComponent(locale)}`, {
    headers: { accept: "application/json" },
    credentials: "same-origin",
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: unknown) => {
      if (isSummary(data)) {
        summary = {
          signedIn: data.signedIn,
          accountHref: data.accountHref,
          name: data.name,
          avatarUrl: data.avatarUrl,
          dashboard:
            data.dashboard &&
            typeof data.dashboard.href === "string" &&
            typeof data.dashboard.labelKey === "string"
              ? {
                  href: data.dashboard.href,
                  labelKey: data.dashboard.labelKey,
                }
              : null,
        };
        emit();
      }
    })
    .catch(() => {
      // A failed fetch leaves the signed-out state rather than showing a link
      // that may not resolve. Clearing the key lets the next mount retry.
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
 * The current account summary, or `null` before the first fetch resolves.
 *
 * The server snapshot is `null` because there is no session information during
 * SSR — the header island renders the signed-out markup on the server and on the
 * first client render, so there is no hydration mismatch.
 */
export function useAccountSummary(
  locale: string,
  pathname: string,
): AccountSummary | null {
  useEffect(() => {
    requestAccountSummary(locale, pathname);
  }, [locale, pathname]);

  return useSyncExternalStore(
    subscribe,
    () => summary,
    () => null,
  );
}
