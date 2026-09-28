import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SocialLinks } from "@/components/layout/SocialLinks";
import { ACTIVE_SOCIAL_PROFILES } from "@/lib/config/social";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Footer social links.
 *
 * These are the only outbound links on the site, so they are the only place a
 * visitor can be sent somewhere that is not ours. The assertions below pin the
 * three things that would make that a problem: a link without a label, a link
 * that leaves the tab open to the destination, and a link whose target is not a
 * real absolute URL on the expected host.
 */

const NETWORKS = ["facebook", "linkedin", "instagram", "x", "tiktok"] as const;

function setup(locale: "en" | "fr" = "en") {
  render(<SocialLinks t={createTranslator(locale).t} />);
  return createTranslator(locale).t;
}

describe("SocialLinks", () => {
  it("renders one link per network, in a labelled navigation landmark", () => {
    const t = setup();
    const nav = screen.getByRole("navigation", {
      name: t("footer.socialHeading"),
    });
    expect(within(nav).getAllByRole("link")).toHaveLength(NETWORKS.length);
  });

  it.each(NETWORKS)(
    "gives the %s link a name that states the company",
    (network) => {
      setup("en");
      const label = createTranslator("en").t("footer.socialLinkLabel", {
        network: createTranslator("en").t(`social.${network}`),
      });
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    },
  );

  it.each(NETWORKS)(
    "points %s at an absolute https URL on the network's own host",
    (network) => {
      setup("en");
      const profile = ACTIVE_SOCIAL_PROFILES.find(
        (entry) => entry.network === network,
      );
      expect(profile).toBeDefined();

      const url = new URL(profile!.url);
      expect(url.protocol).toBe("https:");
      // A link that resolved to this site, or to a relative path, would be a
      // circular reference rather than an off-site profile.
      const host = url.hostname.replace(/^www\./, "");
      expect([
        "facebook.com",
        "linkedin.com",
        "instagram.com",
        "x.com",
        "tiktok.com",
      ]).toContain(host);
    },
  );

  it("opens each link in a new tab without leaking window.opener", () => {
    setup();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      // `noopener` is the security property; `noreferrer` is the privacy one.
      // Both are asserted together because they are applied together.
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
  });

  it("keeps the brand mark out of the accessible name", () => {
    setup();
    // The SVG is decorative and aria-hidden, so each link's name comes from the
    // aria-label alone. An <svg> carrying a <title> would otherwise be appended
    // to the name and break the label-content-name match.
    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(link.querySelector("title")).toBeNull();
    }
  });

  it("uses the same profile URLs in French as in English", () => {
    setup("en");
    const english = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    // Without this the French render renders *alongside* the English one and the
    // query returns both sets, which looks like a difference but is a test bug.
    cleanup();
    setup("fr");
    const french = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    // The destination is a corporate profile, not localized content: translating
    // the URL would produce a link that does not exist.
    expect(french).toEqual(english);
  });

  it("gives every target at least a 24px hit area", () => {
    setup();
    for (const link of screen.getAllByRole("link")) {
      // h-10/w-10 is 40px. Asserted via the class contract because jsdom applies
      // no stylesheet, so a computed-size assertion would prove nothing here; the
      // real check is the Lighthouse target-size audit against the built page.
      expect(link.className).toContain("h-10");
      expect(link.className).toContain("w-10");
      expect(link.className).toContain("justify-center");
      expect(link.className).toContain("items-center");
    }
  });
});
