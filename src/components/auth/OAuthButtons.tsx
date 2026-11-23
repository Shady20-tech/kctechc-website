"use client";

import { signInWithOAuthProviderAction } from "@/lib/auth/actions";
import { enabledOAuthProviders, type OAuthProvider } from "@/lib/auth/oauth";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Brand marks for the three providers.
 *
 * Inline SVG rather than an icon package: Lucide ships no brand logos (its
 * authors removed them deliberately), and these marks are prescribed by the
 * providers' own sign-in guidelines. Each is decorative — the button's visible
 * text is the provider name — so `aria-hidden` keeps the accessible name clean.
 */
function ProviderMark({ provider }: { provider: OAuthProvider }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5">
        <path
          fill="#4285F4"
          d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.56Z"
        />
        <path
          fill="#34A853"
          d="M12 23.5c3.11 0 5.71-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
        />
        <path
          fill="#FBBC05"
          d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.7a11.5 11.5 0 0 0 0 10.3l3.85-2.98Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.7 1.27 15.1.5 12 .5A11.5 11.5 0 0 0 1.7 6.85l3.85 2.98C6.46 7.1 9 4.75 12 4.75Z"
        />
      </svg>
    );
  }

  if (provider === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5">
        <path
          fill="#1877F2"
          d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"
        />
      </svg>
    );
  }

  // Apple's mark is required to be monochrome and to inherit the button's
  // foreground colour, which is why it has no hard-coded fill.
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5">
      <path
        fill="currentColor"
        d="M17.05 12.54c-.03-2.6 2.13-3.85 2.23-3.91-1.21-1.78-3.1-2.02-3.77-2.05-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.31 10.4.87 1.25 1.9 2.66 3.26 2.61 1.31-.05 1.8-.85 3.39-.85 1.58 0 2.03.85 3.41.82 1.41-.02 2.3-1.28 3.16-2.54.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.73-1.05-2.76-4.17ZM14.5 4.6c.72-.87 1.2-2.08 1.07-3.29-1.04.04-2.3.69-3.05 1.56-.67.77-1.25 2-1.09 3.18 1.16.09 2.34-.59 3.07-1.45Z"
      />
    </svg>
  );
}

/** Message key for a provider's button label. */
function providerLabelKey(provider: OAuthProvider): `auth.oauth.${OAuthProvider}` {
  return `auth.oauth.${provider}`;
}

/**
 * Social sign-in buttons.
 *
 * Rendered above the email form, separated by a labelled divider, on both the
 * sign-in and sign-up pages: with OAuth there is no meaningful difference between
 * the two, because the provider creates the account on first use. What the
 * account still owes us — a role declaration and residency — is collected on
 * `/account/onboarding` immediately afterwards, because `signInWithOAuth` accepts
 * no metadata payload.
 *
 * Each button is its own `<form>` posting to a Server Action, so the provider
 * allow-list is enforced server-side and the control degrades to a normal form
 * submission without JavaScript. `min-h-11` keeps the target above the 44px
 * touch minimum, and the label is real text rather than an icon alone.
 */
export function OAuthButtons({
  locale,
  disabled,
}: {
  locale: Locale;
  disabled: boolean;
}) {
  const t = createTranslator(locale).t;
  const providers = enabledOAuthProviders();

  // Nothing configured means nothing rendered: an inert button is worse than no
  // button, and this is the default state of a fresh checkout.
  if (providers.length === 0) return null;

  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {providers.map((provider) => (
          <form key={provider} action={signInWithOAuthProviderAction}>
            <input type="hidden" name="provider" value={provider} />
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              disabled={disabled}
              className="cta-lift flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm font-semibold text-ink-900 transition-soft hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ProviderMark provider={provider} />
              <span>{t(providerLabelKey(provider))}</span>
            </button>
          </form>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="mono-label text-muted">{t("auth.oauthDivider")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
