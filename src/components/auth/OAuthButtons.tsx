"use client";

import { signInWithOAuthProviderAction } from "@/lib/auth/actions";
import { enabledOAuthProviders } from "@/lib/auth/oauth";
import { publicEnv } from "@/lib/config/env";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

import { GoogleSignInButton } from "./GoogleSignInButton";

/**
 * Facebook's brand mark.
 *
 * Inline SVG rather than an icon package: Lucide ships no brand logos (its
 * authors removed them deliberately), and this mark is prescribed by the
 * provider's own sign-in guidelines. It is decorative — the button's visible
 * text names the provider — so `aria-hidden` keeps the accessible name clean.
 */
function FacebookMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="h-5 w-5"
    >
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"
      />
    </svg>
  );
}

/**
 * Social sign-in buttons.
 *
 * Google renders the official Google Identity Services button, which returns an
 * ID token to the browser for `signInWithIdToken`. Facebook keeps the
 * server-side OAuth redirect. The two controls sit in the same grid so the
 * layout stays balanced, and the surrounding forms reserve the same height so a
 * provider that loads a little later does not shift the page.
 *
 * The Facebook control is a real `<form>` posting to a Server Action, so the
 * allow-list is enforced server-side and it degrades to a normal submission
 * without JavaScript. The Google control needs JavaScript by definition; when
 * the client ID is missing it is replaced by a plain notice rather than a button
 * that cannot work.
 */
export function OAuthButtons({
  locale,
  disabled,
  mode = "signin",
  nextPath,
}: {
  locale: Locale;
  disabled: boolean;
  mode?: "signin" | "signup";
  nextPath?: string;
}) {
  const t = createTranslator(locale).t;
  const providers = enabledOAuthProviders();
  const googleEnabled = providers.includes("google");
  const facebookEnabled = providers.includes("facebook");
  const googleConfigured = Boolean(publicEnv.googleClientId);

  const googleVisible = googleEnabled && googleConfigured && !disabled;
  const facebookVisible = facebookEnabled;

  if (!googleVisible && !facebookVisible) {
    if (googleEnabled && !googleConfigured) {
      return (
        <p className="text-sm text-muted">{t("auth.oauthGoogleUnavailable")}</p>
      );
    }
    return null;
  }

  return (
    <div>
      {googleEnabled && !googleConfigured ? (
        <p className="mb-2.5 text-sm text-muted">
          {t("auth.oauthGoogleUnavailable")}
        </p>
      ) : null}

      <div
        className={`grid gap-2.5 ${
          googleVisible && facebookVisible ? "sm:grid-cols-2" : "sm:grid-cols-1"
        }`}
      >
        {googleVisible ? (
          <GoogleSignInButton
            locale={locale}
            mode={mode}
            nextPath={nextPath}
            disabled={disabled}
          />
        ) : null}

        {facebookVisible ? (
          <form action={signInWithOAuthProviderAction}>
            <input type="hidden" name="provider" value="facebook" />
            <input type="hidden" name="locale" value={locale} />
            {nextPath ? (
              <input type="hidden" name="next" value={nextPath} />
            ) : null}
            <button
              type="submit"
              disabled={disabled}
              className="cta-lift flex h-full min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm font-semibold text-ink-900 transition-soft hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FacebookMark />
              <span>{t("auth.oauth.facebook")}</span>
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="mono-label text-muted">{t("auth.oauthDivider")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
