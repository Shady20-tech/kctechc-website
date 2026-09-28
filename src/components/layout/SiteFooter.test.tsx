import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/layout/SiteFooter";
import type { DepartmentSlug } from "@/lib/config/site";
import { FALLBACK_SITE_CONTENT } from "@/lib/config/site-content";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Footer legal links.
 *
 * The footer is on every page, so a wrong href here reaches the whole site. The
 * sign-up form separately links the privacy notice; both are asserted so the two
 * cannot drift to different routes.
 */
function setup(locale: "en" | "fr") {
  return render(
    <SiteFooter
      locale={locale}
      t={createTranslator(locale).t}
      site={FALLBACK_SITE_CONTENT}
      departmentLabels={
        {
          "digital-marketing": "Digital Marketing",
          "electrical-services": "Electrical Services",
          "real-estate": "Real Estate",
        } as Record<DepartmentSlug, string>
      }
    />,
  );
}

describe("SiteFooter legal links", () => {
  for (const locale of ["en", "fr"] as const) {
    it(`links Terms and Privacy for ${locale}`, () => {
      setup(locale);
      const t = createTranslator(locale).t;

      expect(
        screen.getByRole("link", { name: t("footer.terms") }),
      ).toHaveAttribute("href", `/${locale}/terms`);
      expect(
        screen.getByRole("link", { name: t("footer.privacy") }),
      ).toHaveAttribute("href", `/${locale}/privacy`);
    });

    it(`labels the legal column for ${locale}`, () => {
      setup(locale);
      const t = createTranslator(locale).t;
      expect(
        screen.getByRole("heading", { name: t("footer.legalHeading") }),
      ).toBeInTheDocument();
    });
  }

  it("points the privacy link at a page, never a fragment on another page", () => {
    setup("en");
    const href = screen
      .getByRole("link", { name: "Privacy" })
      .getAttribute("href");
    // `#privacy` on the contact page was the interim destination; the notice now
    // has its own route, and a fragment link would be a 404-free but wrong answer.
    expect(href).toBe("/en/privacy");
    expect(href).not.toContain("#");
  });
});

describe("SiteFooter brand block", () => {
  it("shows the corporate mark above the company name", () => {
    setup("en");
    const footer = screen.getByRole("contentinfo");
    const mark = footer.querySelector(
      'img[src="/brand/kc-monogram-inverse.png"]',
    );
    expect(mark).not.toBeNull();

    // The mark is decorative; the lockup's accessible name comes from its text.
    // Scoped to the mark's own ancestor: the footer also has a company-name link
    // whose accessible name matches the same pattern.
    expect(mark).toHaveAttribute("alt", "");
    const homeLink = mark?.closest("a");
    expect(homeLink).not.toBeNull();
    expect(homeLink).toHaveAttribute("href", "/");
    expect(homeLink).toHaveTextContent("KC Technology Corporation");
  });

  it("renders the social links as a labelled landmark inside the footer", () => {
    setup("en");
    const t = createTranslator("en").t;
    const footer = screen.getByRole("contentinfo");
    const nav = within(footer).getByRole("navigation", {
      name: t("footer.socialHeading"),
    });
    // Five networks, all outbound, each opening in a new tab.
    expect(within(nav).getAllByRole("link")).toHaveLength(5);
  });

  it("keeps the footer's landmark name and the social nav name distinct", () => {
    setup("en");
    const t = createTranslator("en").t;
    // Two navigations named "Site footer" (or an unnamed social nav) would be
    // ambiguous in a screen reader's landmark list.
    expect(
      screen.getByRole("contentinfo", { name: t("a11y.footerLandmark") }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: t("footer.socialHeading") }),
    ).toBeInTheDocument();
  });
});
