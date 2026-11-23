import { describe, expect, it } from "vitest";

import {
  OAUTH_PROVIDERS,
  enabledOAuthProviders,
  isOAuthProvider,
  oauthCallbackUrl,
} from "@/lib/auth/oauth";

describe("oauth provider allow-list", () => {
  it("supports exactly the three providers the sign-in pages offer", () => {
    expect(OAUTH_PROVIDERS).toEqual(["google", "facebook", "apple"]);
  });

  it("accepts only a supported provider name", () => {
    for (const provider of OAUTH_PROVIDERS) {
      expect(isOAuthProvider(provider)).toBe(true);
    }
    // A crafted POST must not be able to name an arbitrary provider, because the
    // action forwards the value straight to Supabase.
    for (const value of ["github", "Google", "", null, undefined, 1, {}]) {
      expect(isOAuthProvider(value)).toBe(false);
    }
  });

  it("offers nothing when the deployment has configured nothing", () => {
    // The default state of a fresh checkout: a button for an unconfigured
    // provider is a dead end on the provider's own error page.
    expect(enabledOAuthProviders(undefined)).toEqual([]);
    expect(enabledOAuthProviders("")).toEqual([]);
    expect(enabledOAuthProviders("   ")).toEqual([]);
  });

  it("returns enabled providers in presentation order, not config order", () => {
    expect(enabledOAuthProviders("apple,google")).toEqual(["google", "apple"]);
    expect(enabledOAuthProviders("google,facebook,apple")).toEqual([
      "google",
      "facebook",
      "apple",
    ]);
  });

  it("ignores an unknown or misspelt provider rather than rendering it", () => {
    expect(enabledOAuthProviders("google,github")).toEqual(["google"]);
    expect(enabledOAuthProviders("googel")).toEqual([]);
  });

  it("tolerates spacing and casing in the configuration", () => {
    expect(enabledOAuthProviders(" Google , APPLE ")).toEqual([
      "google",
      "apple",
    ]);
  });
});

describe("oauth callback url", () => {
  it("targets the callback route and carries the locale", () => {
    const url = new URL(oauthCallbackUrl(new URL("https://example.com"), "fr"));
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("locale")).toBe("fr");
  });

  it("builds an absolute url from a base that has a path", () => {
    const url = oauthCallbackUrl(new URL("https://example.com/app"), "en");
    // `new URL` with a leading slash replaces the base path, which is what the
    // callback route expects.
    expect(url).toBe("https://example.com/auth/callback?locale=en");
  });
});
