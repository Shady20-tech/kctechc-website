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
 * Google's brand mark for the server-redirect fallback.
 *
 * The GIS button supplies its own official mark. This one is only used when
 * `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is absent and the form falls back to Supabase's
 * OAuth redirect, so the Google option still appears.
 */
function GoogleMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="h-5 w-5"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.26a12 12 0 0 0 0 10.74l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.63l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/**
 * Social sign-in buttons.
 *
 * Google renders the official Google Identity Services button when
 * `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is configured, which returns an ID token to the
 * browser for `signInWithIdToken`. When the client id is absent it falls back to
 * the Supabase server-side OAuth redirect, so the Google option is never silently
 * removed. Facebook always uses the redirect. The two controls sit in the same
 * grid so the layout stays balanced, and the surrounding forms reserve the same
 * height so a provider that loads a little later does not shift the page.
 *
 * The Facebook and fallback Google controls are real `<form>`s posting to a
 * Server Action, so the allow-list is enforced server-side and they degrade to a
 * normal submission without JavaScript. The GIS Google control needs JavaScript
 * by definition.
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

  // Google is always visible when it is enabled: the GIS button when it can
  // work, otherwise the server-redirect form (disabled if the form is
  // unavailable). Hiding it in the disabled state made an unconfigured preview
  // look as if Google had been removed.
  const googleVisible = googleEnabled;
  const facebookVisible = facebookEnabled;

  if (!googleVisible && !facebookVisible) {
    return null;
  }

  return (
    <div>
      <div
        className={`grid gap-2.5 ${
          googleVisible && facebookVisible ? "sm:grid-cols-2" : "sm:grid-cols-1"
        }`}
      >
        {googleVisible ? (
          googleConfigured && !disabled ? (
            <GoogleSignInButton
              locale={locale}
              mode={mode}
              nextPath={nextPath}
              disabled={disabled}
            />
          ) : (
            <form action={signInWithOAuthProviderAction}>
              <input type="hidden" name="provider" value="google" />
              <input type="hidden" name="locale" value={locale} />
              {nextPath ? (
                <input type="hidden" name="next" value={nextPath} />
              ) : null}
              <button
                type="submit"
                disabled={disabled}
                className="cta-lift flex h-full min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm font-semibold text-ink-900 transition-soft hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleMark />
                <span>{t("auth.oauth.google")}</span>
              </button>
            </form>
          )
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
