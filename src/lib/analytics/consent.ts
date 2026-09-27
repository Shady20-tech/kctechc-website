/**
 * Consent state.
 *
 * Consent is read from a cookie rather than localStorage so the server can also
 * honour it (for any future server-side forwarding) and so it is available
 * before the first paint of the tracking script.
 *
 * Default is **denied**. A visitor who has not answered is treated as having
 * refused until they say otherwise, which is the only default that makes the
 * banner meaningful. The value is not merely a UI preference: `isGranted` gates
 * whether `gtag` is even loaded.
 */

import {
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT,
  type ConsentState,
} from "./events";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Read consent from the cookie. Returns the denied default when absent. */
export function readConsent(): ConsentState {
  if (typeof document === "undefined") return DEFAULT_CONSENT;

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${CONSENT_STORAGE_KEY}=`));
  if (!match) return DEFAULT_CONSENT;

  const raw = decodeURIComponent(match.split("=").slice(1).join("="));
  // Format: "analytics:marketing" as 0/1 flags. Compact and stable.
  const [analytics, marketing] = raw.split(":");
  return {
    analytics: analytics === "1",
    marketing: marketing === "1",
  };
}

/** Persist consent. SameSite=Lax so it is not sent cross-site. */
export function writeConsent(state: ConsentState): void {
  if (typeof document === "undefined") return;

  const value = `${state.analytics ? "1" : "0"}:${state.marketing ? "1" : "0"}`;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_STORAGE_KEY}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

/** True when measurement is permitted. */
export function isAnalyticsGranted(state: ConsentState): boolean {
  return state.analytics;
}

/** Notify listeners so the dispatcher can start collecting after a grant. */
export const CONSENT_EVENT = "kc:consent-changed";

export function announceConsent(state: ConsentState): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }),
  );
}
