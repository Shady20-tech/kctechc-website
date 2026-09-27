import { describe, expect, it } from "vitest";

import { recoveryRedirectUrlFor } from "@/lib/auth/redirects";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

const ORIGIN = new URL("https://kctechc.example");

/**
 * The recovery link has to go through `/auth/callback`, not straight to the form.
 *
 * Supabase puts the PKCE `code` on the redirect URL, and only `/auth/callback`
 * exchanges it for a session. The original bug pointed `redirectTo` at
 * `/auth/reset-password` — a route that never existed — so every recovery email
 * dead-ended on a 404. These pin both halves of the correct shape.
 */
describe("recoveryRedirectUrlFor", () => {
  it("routes through the callback with a locale-scoped next target", () => {
    const url = new URL(recoveryRedirectUrlFor("fr", ORIGIN));
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("next")).toBe("/fr/admin/reset-password");
  });

  it("uses the default locale when the cookie is absent", () => {
    const url = new URL(recoveryRedirectUrlFor(undefined, ORIGIN));
    expect(url.searchParams.get("next")).toBe(
      `/${DEFAULT_LOCALE}/admin/reset-password`,
    );
  });

  it("ignores a locale the app does not support", () => {
    const url = new URL(recoveryRedirectUrlFor("de", ORIGIN));
    expect(url.searchParams.get("next")).toBe(
      `/${DEFAULT_LOCALE}/admin/reset-password`,
    );
  });

  it("never emits a bare page path that skips the code exchange", () => {
    for (const cookie of [undefined, "en", "fr", "xx"]) {
      const url = new URL(recoveryRedirectUrlFor(cookie, ORIGIN));
      expect(url.pathname).not.toBe("/auth/reset-password");
      expect(url.searchParams.get("next")).toMatch(
        /^\/[a-z]{2}\/admin\/reset-password$/,
      );
    }
  });
});
