"use client";

/**
 * The analytics dispatcher.
 *
 * The one place that talks to `gtag`. Components import `track` and never touch
 * the global, so:
 *
 *   * measurement can be disabled in one place (tests, staging, no consent);
 *   * redaction cannot be bypassed by a component that "just" calls gtag;
 *   * the gtag script is not even loaded without consent, so a refused visitor
 *     makes no network request to Google at all.
 *
 * Events fired without consent are **dropped**, not buffered. Buffering them and
 * sending on a later grant would mean a visitor who had not yet answered was
 * measured anyway, which is the thing consent is supposed to prevent. Dropping is
 * the only behaviour consistent with the default being "denied".
 */

import {
  type AnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsItem,
} from "./events";
import {
  CONSENT_EVENT,
  isAnalyticsGranted,
  readConsent,
} from "./consent";
import { sanitizeEvent } from "./redact";

type GtagFunction = (
  command: "event" | "config" | "consent" | "js" | "set",
  ...args: unknown[]
) => void;

declare global {
  interface Window {
    gtag?: GtagFunction;
    dataLayer?: unknown[];
  }
}

let initialized = false;
let listenerAttached = false;

function measurementId(): string {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
}

/**
 * True when analytics is enabled *and* consented to.
 *
 * Both conditions are required: a missing measurement id means the site is
 * running unconfigured (staging, a fresh checkout) and must not phone home.
 */
export function isTrackingEnabled(): boolean {
  return measurementId().length > 0 && isAnalyticsGranted(readConsent());
}

/**
 * Load the gtag script once, and only after consent.
 *
 * Called lazily on the first granted event rather than on mount, which is what
 * keeps a refused visitor free of third-party requests.
 */
function ensureLoaded(): void {
  if (initialized || typeof window === "undefined") return;
  const id = measurementId();
  if (!id) return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  // Consent Mode v2, set before config so the first hit respects it.
  window.gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: isAnalyticsGranted(readConsent()) ? "granted" : "denied",
  });

  window.gtag("js", new Date());
  // send_page_view false: navigation is measured explicitly by the page-view
  // component so SPA route changes are counted once, not twice.
  window.gtag("config", id, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  initialized = true;
}

/**
 * Dispatch one event.
 *
 * Redaction happens here, not at the call site, so it cannot be skipped. Without
 * consent the event is dropped before any network activity occurs.
 */
export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  if (!isTrackingEnabled()) return;

  ensureLoaded();

  const { name, params } = sanitizeEvent(event);
  window.gtag?.("event", name, params);
}

/**
 * Attach the consent listener once, from the consent provider.
 *
 * Nothing is buffered, so a grant has nothing to flush; the listener exists only
 * to load gtag and send Consent Mode an update the moment a visitor opts in,
 * without waiting for a reload.
 */
export function startConsentListener(): void {
  if (listenerAttached || typeof window === "undefined") return;
  listenerAttached = true;

  window.addEventListener(CONSENT_EVENT, (event) => {
    const detail = (event as CustomEvent<{ analytics: boolean }>).detail;
    if (!detail?.analytics) return;
    ensureLoaded();
  });
}

/** Measure a page view for a route change. Called by the page-view component. */
export function trackPageView(path: string, title?: string): void {
  // GA4's `page_view` is the reserved name for this; sending it through the
  // allowlist would drop `page_location`/`page_title`, which are not user data
  // but are required for the built-in report. They are emitted directly.
  if (!isTrackingEnabled()) return;
  ensureLoaded();
  window.gtag?.("event", "page_view", {
    page_path: path,
    ...(title ? { page_title: title } : {}),
  });
}

/** Convenience wrapper for ecommerce events, used by store components. */
export function trackEcommerce(
  name: Extract<
    AnalyticsEventName,
    | "view_item_list"
    | "view_item"
    | "select_item"
    | "add_to_cart"
    | "remove_from_cart"
    | "begin_checkout"
    | "purchase"
  >,
  params: {
    items: AnalyticsItem[];
    value?: number;
    currency?: string;
    content_id?: string;
    /**
     * The order reference. Required by GA4 on `purchase` and used by it to
     * deduplicate; harmless elsewhere.
     */
    transaction_id?: string;
  },
): void {
  track({ name, params });
}
