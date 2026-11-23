import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  OAUTH_PROVIDERS,
  enabledOAuthProviders,
  isOAuthProvider,
  oauthCallbackUrl,
} from "@/lib/auth/oauth";

function readEnvTemplate(): string {
  return readFileSync(join(process.cwd(), ".env.example"), "utf8");
}

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

describe("the env template documents how to turn social sign-in on", () => {
  it("names the flag, because an undocumented flag is an invisible feature", () => {
    // The buttons are gated on NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS, so an operator
    // who never learns the flag exists sees a sign-in page with no social
    // buttons and no clue that anything is missing. That is exactly how this
    // feature shipped invisible once.
    const template = readEnvTemplate();
    expect(template).toContain("NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS");
  });

  it("documents every provider the code can offer", () => {
    const template = readEnvTemplate();
    for (const provider of OAUTH_PROVIDERS) {
      expect(template).toContain(provider);
    }
    // And the redirect URL, which Supabase refuses the flow without.
    expect(template).toContain("/auth/callback");
  });

  it("keeps the template's default empty, so nothing is offered unconfigured", () => {
    const template = readEnvTemplate();
    expect(template).toMatch(/NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS=""\s*$/m);
    expect(enabledOAuthProviders("")).toEqual([]);
  });
});
