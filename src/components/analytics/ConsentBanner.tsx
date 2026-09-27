"use client";

import { useSyncExternalStore, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  CONSENT_EVENT,
  announceConsent,
  isAnalyticsGranted,
  readConsent,
  writeConsent,
} from "@/lib/analytics/consent";
import {
  DEFAULT_CONSENT,
  CONSENT_STORAGE_KEY,
  type ConsentState,
} from "@/lib/analytics/events";
import { startConsentListener } from "@/lib/analytics/track";

/** True once the visitor has made a choice, whether that was to allow or refuse. */
function subscribe(onChange: () => void): () => void {
  startConsentListener();
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

function getHasDecided(): boolean {
  return document.cookie.includes(`${CONSENT_STORAGE_KEY}=`);
}

/**
 * The server does not read cookies, so it renders no banner. Reporting "decided"
 * for the server snapshot means hydration matches the server output, and React
 * then re-renders on the client from the real cookie. Returning "undecided" here
 * would render a banner on the server that may not belong, which is a hydration
 * mismatch rather than a correct empty state.
 */
function getServerHasDecided(): boolean {
  return true;
}

/**
 * Cookie consent banner.
 *
 * Measurement is off until the visitor says otherwise. The banner is the only
 * way that changes, and it writes a cookie the dispatcher reads before it loads
 * `gtag` — so a refusal means no request to Google at all, not a request that is
 * discarded client-side.
 *
 * Two controls rather than one "OK": analytics and advertising are separate
 * decisions, and collapsing them into a single acceptance would collect for the
 * second purpose on consent given for the first.
 *
 * The banner has no dismiss-without-choosing path. A close button would let the
 * question go unanswered while the banner disappeared, which reads as consent to
 * most visitors and is not.
 */
export function ConsentBanner({ locale }: { locale: Locale }) {
  const t = createTranslator(locale).t;
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ConsentState>(DEFAULT_CONSENT);

  // The cookie is an external store. Reading it through `useSyncExternalStore`
  // means the server snapshot ("already decided", so nothing renders) matches the
  // first client render, and the banner appears on the client frame after when
  // there is genuinely no choice recorded yet.
  const hasDecided = useSyncExternalStore(
    subscribe,
    getHasDecided,
    getServerHasDecided,
  );

  if (hasDecided || dismissed) return null;

  const commit = (state: ConsentState) => {
    writeConsent(state);
    announceConsent(state);
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-heading"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-strong bg-surface px-4 py-4 shadow-card sm:px-6"
    >
      <div className="container-page">
        <h2 id="consent-heading" className="text-base font-semibold text-ink-900">
          {t("consent.heading")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-body">{t("consent.body")}</p>

        {expanded ? (
          <fieldset className="mt-4 space-y-3">
            <legend className="visually-hidden">
              {t("consent.settingsHeading")}
            </legend>

            <label className="flex items-start gap-3 text-sm text-body">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={draft.analytics}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    analytics: event.currentTarget.checked,
                  }))
                }
                aria-describedby="consent-analytics-hint"
              />
              <span>
                <span className="font-medium text-ink-900">
                  {t("consent.analyticsLabel")}
                </span>
                <span id="consent-analytics-hint" className="mt-0.5 block text-muted">
                  {t("consent.analyticsHint")}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-body">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={draft.marketing}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    marketing: event.currentTarget.checked,
                  }))
                }
                aria-describedby="consent-marketing-hint"
              />
              <span>
                <span className="font-medium text-ink-900">
                  {t("consent.marketingLabel")}
                </span>
                <span id="consent-marketing-hint" className="mt-0.5 block text-muted">
                  {t("consent.marketingHint")}
                </span>
              </span>
            </label>
          </fieldset>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() =>
              commit({
                analytics: true,
                // In the expanded view the marketing choice is the visitor's,
                // so it is honoured here too rather than silently reset.
                marketing: expanded ? draft.marketing : false,
              })
            }
          >
            {t("consent.acceptAll")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => commit(DEFAULT_CONSENT)}
          >
            {t("consent.rejectAll")}
          </Button>
          {expanded ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => commit(draft)}
            >
              {t("consent.save")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(true)}
            >
              {t("consent.settingsHeading")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** True when measurement may run. Exposed for tests and diagnostics. */
export function consentGranted(): boolean {
  return isAnalyticsGranted(readConsent());
}
