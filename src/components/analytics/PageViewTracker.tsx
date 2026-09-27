"use client";

import { useEffect } from "react";
import { trackPageView } from "@/lib/analytics/track";

/**
 * Fires a `page_view` on client-side navigation.
 *
 * A hard navigation gets its page view from `gtag`'s automatic `config` call,
 * but an App Router transition swaps the tree without reloading the page, so
 * without this the second page visited in a session would not be counted. The
 * event is a no-op unless consent was granted — `trackPageView` checks, rather
 * than this component, so every caller inherits the rule.
 */
export function PageViewTracker({ path }: { path: string }) {
  useEffect(() => {
    trackPageView(path);
  }, [path]);

  return null;
}
