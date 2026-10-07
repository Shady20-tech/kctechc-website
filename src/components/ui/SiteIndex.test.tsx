import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteIndex } from "@/components/ui/SiteIndex";
import { DEPARTMENTS } from "@/lib/config/site";
import {
  INSIGHTS_PATH,
  PROPERTY_SEARCH_PATH,
  SOLAR_PACKAGES_PATH,
  STORE_PATH,
} from "@/lib/config/redirects";
import { departmentHasServices } from "@/lib/content/defaults";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Site index.
 *
 * The index exists so the homepage can carry every public destination. The
 * assertions that matter are that the department sub-surfaces are gated on the
 * same predicate the routes use — the index must never link a 404 — and that
 * every link is locale-qualified.
 */

function setup(locale: "en" | "fr") {
  const t = createTranslator(locale).t;
  return render(
    <SiteIndex
      locale={locale}
      t={t}
      eyebrow={t("home.indexEyebrow")}
      heading={t("home.indexHeading")}
      intro={t("home.indexIntro")}
    />,
  );
}

describe("SiteIndex", () => {
  for (const locale of ["en", "fr"] as const) {
    it(`lists every department with a locale-qualified landing link (${locale})`, () => {
      setup(locale);
      const t = createTranslator(locale).t;
      for (const department of DEPARTMENTS) {
        const nav = screen.getByRole("navigation", {
          name: t(department.labelKey),
        });
        const home = within(nav).getByRole("link", { name: t("nav.home") });
        expect(home).toHaveAttribute("href", `/${locale}/${department.slug}`);
      }
    });

    it(`advertises department services only where the route exists (${locale})`, () => {
      setup(locale);
      const t = createTranslator(locale).t;
      for (const department of DEPARTMENTS) {
        const nav = screen.getByRole("navigation", {
          name: t(department.labelKey),
        });
        const servicesLink = within(nav).queryByRole("link", {
          name: t("nav.services"),
        });
        const projectsLink = within(nav).queryByRole("link", {
          name: t("projects.heading"),
        });
        if (departmentHasServices(department.slug)) {
          expect(servicesLink).toHaveAttribute(
            "href",
            `/${locale}/${department.slug}/services`,
          );
          expect(projectsLink).toHaveAttribute(
            "href",
            `/${locale}/${department.slug}/projects`,
          );
        } else {
          expect(servicesLink).not.toBeInTheDocument();
          expect(projectsLink).not.toBeInTheDocument();
        }
      }
    });
  }

  it("lists the company surfaces, including the store, listings and insights", () => {
    setup("en");
    const nav = screen.getByRole("navigation", { name: "Company" });
    expect(within(nav).getByRole("link", { name: "Store" })).toHaveAttribute(
      "href",
      `/en${STORE_PATH}`,
    );
    expect(
      within(nav).getByRole("link", { name: "The full portfolio" }),
    ).toHaveAttribute("href", `/en${PROPERTY_SEARCH_PATH}`);
    expect(within(nav).getByRole("link", { name: "Insights" })).toHaveAttribute(
      "href",
      `/en${INSIGHTS_PATH}`,
    );
  });

  it("lists the legal pages", () => {
    setup("en");
    const nav = screen.getByRole("navigation", { name: "Legal" });
    expect(within(nav).getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/en/terms",
    );
    expect(within(nav).getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/en/privacy",
    );
  });

  it("scopes every department card to its own accent", () => {
    // The card rail and the link hover colour read `--dept-accent`, which falls
    // back to corporate teal unless the subtree declares `data-department`. A
    // missing attribute is silent, so it is asserted rather than eyeballed.
    setup("en");
    const t = createTranslator("en").t;
    for (const department of DEPARTMENTS) {
      const nav = screen.getByRole("navigation", {
        name: t(department.labelKey),
      });
      expect(nav).toHaveAttribute("data-department", department.slug);
    }
  });

  it("qualifies every link with the requested locale", () => {
    const { container } = setup("fr");
    const hrefs = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((href) => href?.startsWith("/fr"))).toBe(true);
  });

  it("does not link any route the sitemap would not advertise", () => {
    const { container } = setup("en");
    const allowed = new Set([
      "/en",
      "/en/about",
      "/en/services",
      "/en/gallery",
      "/en/insights",
      "/en/contact",
      `/en${STORE_PATH}`,
      `/en${PROPERTY_SEARCH_PATH}`,
      "/en/terms",
      "/en/privacy",
      ...DEPARTMENTS.flatMap((department) => [
        `/en/${department.slug}`,
        ...(department.slug === "electrical-services"
          ? [`/en${SOLAR_PACKAGES_PATH}`]
          : []),
        ...(departmentHasServices(department.slug)
          ? [
              `/en/${department.slug}/services`,
              `/en/${department.slug}/projects`,
              `/en/${department.slug}/portfolio`,
            ]
          : []),
      ]),
    ]);
    for (const anchor of container.querySelectorAll("a")) {
      expect(allowed.has(anchor.getAttribute("href") ?? "")).toBe(true);
    }
  });
});
