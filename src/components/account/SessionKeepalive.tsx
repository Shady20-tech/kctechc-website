"use client";

import { useEffect } from "react";

/**
 * Keeps a dashboard session warm while the tab is open.
 *
 * The proxy refreshes the Supabase cookie pair on a request. A dashboard left
 * idle for a long time issues none, so an access token can expire between the
 * page rendering and the next click; the guard then sends the page to sign-in,
 * which a user reasonably reads as the dashboard refreshing itself. A small
 * visibility-aware ping gives the proxy the request it needs to rotate the
 * session without touching page data.
 *
 * Nothing is rendered and no response body is used: `/api/account/summary` is
 * already the session-scoped endpoint the public header calls, and its
 * `no-store` response means this cannot populate a cache.
 */
const KEEPALIVE_MS = 4 * 60 * 1000;

export function SessionKeepalive() {
  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void fetch("/api/account/summary?locale=en", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      }).catch(() => {
        // A failed ping leaves the session exactly as it was; the next real
        // request still goes through the proxy's refresh path.
      });
    };

    const timer = window.setInterval(ping, KEEPALIVE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
