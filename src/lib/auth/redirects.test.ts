import { describe, expect, it } from "vitest";

import {
  postSignInPathFor,
  recoveryRedirectUrlFor,
} from "@/lib/auth/redirects";
import { APP_ROLES, isAdminRole } from "@/lib/auth/roles";
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

/**
 * The post-sign-in landing must not send a customer into the admin console.
 *
 * `/admin` is guarded by `requireAdmin`, which redirects every non-admin to the
 * "Access denied" page. The public header's only account action used to sign a
 * customer in and then drop them straight onto that refusal, which reads as a
 * broken login rather than a correctly signed-in visitor who is simply not staff.
 */
describe("postSignInPathFor", () => {
  it("sends an admin to the non-localized console", () => {
    expect(postSignInPathFor("super_admin", "en")).toBe("/admin");
    expect(postSignInPathFor("super_admin", "fr")).toBe("/admin");
  });

  it("sends every non-admin role to the account hub", () => {
    for (const role of APP_ROLES) {
      if (isAdminRole(role)) continue;
      expect(postSignInPathFor(role, "en")).toBe("/en/account");
    }
  });

  it("keeps the requested locale", () => {
    expect(postSignInPathFor("customer", "fr")).toBe("/fr/account");
  });

  it("falls back to the default locale for an unsupported one", () => {
    expect(postSignInPathFor("customer", "de")).toBe(
      `/${DEFAULT_LOCALE}/account`,
    );
  });

  it("never lands a non-admin under /admin", () => {
    for (const role of APP_ROLES) {
      const path = postSignInPathFor(role, "en");
      if (isAdminRole(role)) {
        // The console is the bare `/admin` route group, never locale-prefixed.
        expect(path).toBe("/admin");
      } else {
        expect(path).not.toContain("/admin");
      }
    }
  });
});
