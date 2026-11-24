"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { completeOAuthSignInAction } from "@/lib/auth/actions";
import { publicEnv } from "@/lib/config/env";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { createClient } from "@/lib/supabase/client";

/** The official Google Identity Services client script. */
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  ux_mode?: "popup" | "redirect";
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  nonce?: string;
};

type GoogleButtonOptions = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
};

type GoogleAccountsId = {
  initialize: (options: GoogleIdConfiguration) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

/**
 * A nonce binds the ID token Google returns to this page load, so a token
 * captured elsewhere cannot be replayed against Supabase. `getRandomValues` is
 * available in every browser the site supports.
 */
function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * The official Google Sign-In button, backed by Google Identity Services.
 *
 * `supabase.auth.signInWithOAuth({ provider: "google" })` sends the browser
 * through the Supabase project's `/auth/v1/callback`, so Google's consent screen
 * names the Supabase project host. GIS returns a Google ID token directly to this
 * page; `signInWithIdToken` verifies it against the Google client configured in
 * Supabase. The consent screen therefore belongs to this site's Google Cloud
 * project, which is what shows the verified domain and the brand name.
 *
 * The button itself is rendered by Google into an iframe (`renderButton`), which
 * is the only way to get the official mark and wording. The surrounding layout
 * reserves the same 48px height as the email and Facebook controls.
 */
export function GoogleSignInButton({
  locale,
  mode = "signin",
  nextPath,
  disabled = false,
}: {
  locale: Locale;
  mode?: "signin" | "signup";
  nextPath?: string;
  disabled?: boolean;
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = publicEnv.googleClientId;

  const handleScriptReady = useCallback(() => setScriptReady(true), []);
  const handleScriptError = useCallback(() => setScriptFailed(true), []);

  useEffect(() => {
    if (!scriptReady || !clientId || disabled) return;

    const container = containerRef.current;
    const google = window.google?.accounts?.id;
    if (!container || !google) {
      setScriptFailed(true);
      return;
    }

    const translate = createTranslator(locale).t;
    nonceRef.current ??= createNonce();
    const nonce = nonceRef.current;
    let lastWidth = 0;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      const width = Math.min(
        400,
        Math.max(200, Math.round(container.clientWidth || 320)),
      );
      if (width === lastWidth) return;
      lastWidth = width;

      container.replaceChildren();
      google.initialize({
        client_id: clientId,
        callback: (response) => {
          void (async () => {
            if (!response.credential) {
              setError(translate("auth.oauthFailed"));
              return;
            }

            setLoading(true);
            setError(null);
            try {
              const supabase = createClient();
              const { error: signInError } =
                await supabase.auth.signInWithIdToken({
                  provider: "google",
                  token: response.credential,
                  nonce,
                });

              if (signInError) {
                setError(translate("auth.oauthFailed"));
                return;
              }

              const completion = await completeOAuthSignInAction({
                locale,
                next: nextPath,
              });
              if (completion.status === "error") {
                setError(translate(completion.messageKey));
                return;
              }

              router.push(completion.path);
              router.refresh();
            } catch {
              setError(translate("auth.oauthFailed"));
            } finally {
              setLoading(false);
            }
          })();
        },
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        nonce,
      });
      google.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: mode === "signup" ? "signup_with" : "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width,
        locale: locale === "fr" ? "fr" : "en",
      });
    };

    render();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => {
      cancelled = true;
      observer.disconnect();
      container.replaceChildren();
    };
  }, [scriptReady, clientId, disabled, locale, mode, nextPath, router]);

  if (!clientId || disabled) return null;

  return (
    <div className="w-full">
      <Script
        id="google-identity-services"
        src={GOOGLE_IDENTITY_SCRIPT}
        strategy="afterInteractive"
        onReady={handleScriptReady}
        onError={handleScriptError}
      />
      <div className="relative">
        <div
          ref={containerRef}
          className="flex min-h-12 w-full items-center justify-center"
        />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-control bg-surface/95 text-sm font-semibold text-ink-700">
            <span role="status">{t("auth.oauthSigningIn")}</span>
          </div>
        ) : null}
      </div>
      {scriptFailed || error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error ?? t("auth.oauthFailed")}
        </p>
      ) : null}
    </div>
  );
}
