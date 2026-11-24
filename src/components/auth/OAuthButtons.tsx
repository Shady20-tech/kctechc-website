"use client";

import type { ReactNode } from "react";

import { signInWithOAuthProviderAction } from "@/lib/auth/actions";
import { enabledOAuthProviders, type OAuthProvider } from "@/lib/auth/oauth";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

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

/** Google's brand mark for the sign-in button. */
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
 * One provider button.
 *
 * Both providers use the same Supabase server-side OAuth redirect, so the only
 * difference is the mark, the label and the provider value. A real `<form>`
 * means the control degrades to a normal submission without JavaScript.
 */
function ProviderButton({
  provider,
  label,
  mark,
  locale,
  nextPath,
  disabled,
}: {
  provider: OAuthProvider;
  label: string;
  mark: ReactNode;
  locale: Locale;
  nextPath?: string;
  disabled: boolean;
}) {
  return (
    <form action={signInWithOAuthProviderAction}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="locale" value={locale} />
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <button
        type="submit"
        disabled={disabled}
        className="cta-lift flex h-full min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm font-semibold text-ink-900 transition-soft hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {mark}
        <span>{label}</span>
      </button>
    </form>
  );
}

/**
 * Social sign-in buttons.
 *
 * Google and Facebook both use Supabase's server-side OAuth redirect. The
 * provider client IDs and secrets live in the Supabase dashboard; this app only
 * decides which providers to offer through `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS`.
 * The two controls sit in the same grid so the layout stays balanced, and the
 * surrounding forms reserve the same height so a provider that loads a little
 * later does not shift the page.
 *
 * A provider that is disabled (Supabase unconfigured) still renders its button,
 * disabled, so the page does not look as if a provider had been removed.
 */
export function OAuthButtons({
  locale,
  disabled,
  nextPath,
}: {
  locale: Locale;
  disabled: boolean;
  nextPath?: string;
}) {
  const t = createTranslator(locale).t;
  const providers = enabledOAuthProviders();
  const googleVisible = providers.includes("google");
  const facebookVisible = providers.includes("facebook");

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
          <ProviderButton
            provider="google"
            label={t("auth.oauth.google")}
            mark={<GoogleMark />}
            locale={locale}
            nextPath={nextPath}
            disabled={disabled}
          />
        ) : null}
        {facebookVisible ? (
          <ProviderButton
            provider="facebook"
            label={t("auth.oauth.facebook")}
            mark={<FacebookMark />}
            locale={locale}
            nextPath={nextPath}
            disabled={disabled}
          />
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
