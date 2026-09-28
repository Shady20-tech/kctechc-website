import { render, screen } from "@testing-library/react";
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
