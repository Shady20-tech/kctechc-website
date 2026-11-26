import { describe, expect, it } from "vitest";

import {
  confirmationRedirectUrl,
  postSignInPathFor,
} from "@/lib/auth/redirects";
import { APP_ROLES, isAdminRole } from "@/lib/auth/roles";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

const ORIGIN = new URL("https://kctechc.example");

/**
 * A confirmation link must not hardcode a console destination.
 *
 * Self-registration always creates a `customer`, so `next=/admin` sent every
 * newly confirmed customer into a console that refuses them. With no `next`,
 * `/auth/callback` decides by role: customers to the account hub, staff to the
 * console.
 */
describe("confirmationRedirectUrl", () => {
  it("lands on the callback without a hardcoded destination", () => {
    const url = new URL(confirmationRedirectUrl(ORIGIN));
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("next")).toBeNull();
  });

  it("keeps the supplied origin", () => {
    expect(confirmationRedirectUrl(ORIGIN)).toBe(
      "https://kctechc.example/auth/callback",
    );
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
