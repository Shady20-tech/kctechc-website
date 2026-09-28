import { describe, expect, it } from "vitest";

import {
  ACTIVE_SOCIAL_PROFILES,
  SOCIAL_PROFILES,
  socialProfileUrls,
} from "@/lib/config/social";

/**
 * Social profile configuration.
 *
 * The footer renders whatever is in `SOCIAL_PROFILES` and the `Organization`
 * structured data publishes the same URLs as `sameAs`, so a mistake here becomes
 * a public claim that an account belongs to the company. These tests hold the
 * shape of that promise: the networks we advertise, one entry each, and URLs that
 * are well-formed, absolute and on the network's own host.
 */

const NETWORKS = ["facebook", "linkedin", "instagram", "x", "tiktok"] as const;

/** The host each network's profile URLs must live on. */
const EXPECTED_HOST: Record<(typeof NETWORKS)[number], string> = {
  facebook: "facebook.com",
  linkedin: "linkedin.com",
  instagram: "instagram.com",
  x: "x.com",
  tiktok: "tiktok.com",
};

describe("SOCIAL_PROFILES", () => {
  it("declares every required network exactly once", () => {
    const networks = SOCIAL_PROFILES.map((profile) => profile.network);
    expect([...networks].sort()).toEqual([...NETWORKS].sort());
    expect(new Set(networks).size).toBe(networks.length);
  });

  it("keeps the declared order stable", () => {
    // The order is the display order in the footer. Pinned so a reorder is a
    // deliberate change with a visible consequence rather than an accident.
    expect(SOCIAL_PROFILES.map((profile) => profile.network)).toEqual(NETWORKS);
  });

  it.each(NETWORKS)("has a well-formed profile URL for %s", (network) => {
    const profile = SOCIAL_PROFILES.find((entry) => entry.network === network);
    expect(profile?.url).toBeTruthy();

    const url = new URL(profile!.url as string);
    expect(url.protocol).toBe("https:");
    expect(url.hostname.replace(/^www\./, "")).toBe(EXPECTED_HOST[network]);
    // A profile URL is a real path, not a bare host with no account.
    expect(url.pathname.replace(/\/$/, "").length).toBeGreaterThan(1);
  });

  it("labels every profile with a translation key", () => {
    for (const profile of SOCIAL_PROFILES) {
      expect(profile.labelKey).toBe(`social.${profile.network}`);
    }
  });

  it("exposes only entries with a URL through the active list", () => {
    for (const profile of ACTIVE_SOCIAL_PROFILES) {
      expect(typeof profile.url).toBe("string");
      expect(profile.url.length).toBeGreaterThan(0);
    }
    expect(ACTIVE_SOCIAL_PROFILES.length).toBe(
      SOCIAL_PROFILES.filter((profile) => profile.url !== null).length,
    );
  });
});

describe("socialProfileUrls", () => {
  it("returns an absolute https URL for every profile", () => {
    const urls = socialProfileUrls();
    expect(urls.length).toBe(ACTIVE_SOCIAL_PROFILES.length);
    for (const raw of urls) {
      const url = new URL(raw);
      expect(url.protocol).toBe("https:");
    }
  });

  it("never returns a link back to this site", () => {
    // `sameAs` means "a different site for this same entity". A self-referential
    // URL there is a meaningless claim, so it is filtered out.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!siteUrl) return;
    const ownHost = new URL(siteUrl).hostname;
    for (const raw of socialProfileUrls()) {
      expect(new URL(raw).hostname).not.toBe(ownHost);
    }
  });
});
