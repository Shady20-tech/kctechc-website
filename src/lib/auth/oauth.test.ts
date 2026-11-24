import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  OAUTH_PROVIDERS,
  SERVER_OAUTH_PROVIDERS,
  enabledOAuthProviders,
  isOAuthProvider,
  isServerOAuthProvider,
  oauthCallbackUrl,
} from "@/lib/auth/oauth";

function readEnvTemplate(): string {
  return readFileSync(join(process.cwd(), ".env.example"), "utf8");
}

describe("oauth provider allow-list", () => {
  it("supports exactly the two providers the sign-in pages offer", () => {
    expect(OAUTH_PROVIDERS).toEqual(["google", "facebook"]);
  });

  it("does not offer Apple, which this deployment does not support", () => {
    expect(OAUTH_PROVIDERS).not.toContain("apple");
    expect(isOAuthProvider("apple")).toBe(false);
    expect(enabledOAuthProviders("google,facebook,apple")).toEqual([
      "google",
      "facebook",
    ]);
  });

  it("accepts only a supported provider name", () => {
    for (const provider of OAUTH_PROVIDERS) {
      expect(isOAuthProvider(provider)).toBe(true);
    }
    // A crafted POST must not be able to name an arbitrary provider, because the
    // action forwards the value straight to Supabase.
    for (const value of [
      "apple",
      "github",
      "Google",
      "",
      null,
      undefined,
      1,
      {},
    ]) {
      expect(isOAuthProvider(value)).toBe(false);
    }
  });

  it("offers Google and Facebook when the deployment has not narrowed the set", () => {
    // Unset or blank means "the providers this site ships with", so the buttons
    // appear without any environment configuration.
    expect(enabledOAuthProviders(undefined)).toEqual(["google", "facebook"]);
    expect(enabledOAuthProviders("")).toEqual(["google", "facebook"]);
    expect(enabledOAuthProviders("   ")).toEqual(["google", "facebook"]);
  });

  it("offers nothing when the deployment explicitly disables social sign-in", () => {
    // A value that names no supported provider is the opt-out.
    expect(enabledOAuthProviders("none")).toEqual([]);
  });

  it("returns enabled providers in presentation order, not config order", () => {
    expect(enabledOAuthProviders("facebook,google")).toEqual([
      "google",
      "facebook",
    ]);
  });

  it("ignores an unknown or misspelt provider rather than rendering it", () => {
    expect(enabledOAuthProviders("google,github")).toEqual(["google"]);
    expect(enabledOAuthProviders("googel")).toEqual([]);
  });

  it("tolerates spacing and casing in the configuration", () => {
    expect(enabledOAuthProviders(" Google , FACEBOOK ")).toEqual([
      "google",
      "facebook",
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

  it("carries a validated next path when one is supplied", () => {
    const url = new URL(
      oauthCallbackUrl(new URL("https://example.com"), "en", "/en/account"),
    );
    expect(url.searchParams.get("next")).toBe("/en/account");
  });
});

describe("server-side oauth providers", () => {
  it("keeps Google off the server redirect because it uses GIS", () => {
    expect(SERVER_OAUTH_PROVIDERS).toEqual(["facebook"]);
    expect(isServerOAuthProvider("facebook")).toBe(true);
    for (const value of ["google", "apple", "", null, undefined, 1]) {
      expect(isServerOAuthProvider(value)).toBe(false);
    }
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

  it("documents the Google Identity Services client id", () => {
    // GIS needs the public client id in the browser; without it the Google
    // button cannot render and the operator has no clue which variable to set.
    expect(readEnvTemplate()).toContain("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  });

  it("does not advertise the removed Apple provider", () => {
    expect(readEnvTemplate()).not.toContain("apple");
  });

  it("defaults to Google and Facebook, so the buttons are visible", () => {
    const template = readEnvTemplate();
    expect(template).toMatch(
      /NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS="google,facebook"\s*$/m,
    );
    expect(enabledOAuthProviders(undefined)).toEqual(["google", "facebook"]);
  });
});
