import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandStrip } from "@/components/content/BrandStrip";
import { ELECTRICAL_BRANDS } from "@/lib/content/electrical-brands";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Electrical Services brand strip.
 *
 * The property that matters is that both brands and their categories are in the
 * server-rendered HTML — the component has no client state, so the first render
 * *is* what a crawler and a no-JavaScript visitor receive. A brand name that was
 * added only to one locale, or dropped behind a client interaction, would be
 * invisible here.
 */
function setup(locale: "en" | "fr" = "en") {
  const t = createTranslator(locale).t;
  return render(
    <BrandStrip
      t={t}
      eyebrow={`02 — ${t("electricalProducts.brands.eyebrow")}`}
      heading={t("electricalProducts.brands.heading")}
      intro={t("electricalProducts.brands.intro")}
      headingId="electrical-brands-heading"
    />,
  );
}

describe("BrandStrip", () => {
  it("renders both brand names and their categories", () => {
    const t = createTranslator("en").t;
    setup();
    for (const brand of ELECTRICAL_BRANDS) {
      expect(screen.getByText(brand.name)).toBeInTheDocument();
      expect(screen.getByText(t(brand.categoryKey))).toBeInTheDocument();
    }
  });

  it("names SAKO POWER for solar and HIKVISION for CCTV", () => {
    setup();
    expect(screen.getByText("SAKO POWER")).toBeInTheDocument();
    expect(screen.getByText("Solar components")).toBeInTheDocument();
    expect(screen.getByText("HIKVISION")).toBeInTheDocument();
    expect(screen.getByText("CCTV components")).toBeInTheDocument();
  });

  it("labels the heading so the section can be named by it", () => {
    setup();
    const heading = screen.getByRole("heading", {
      name: createTranslator("en").t("electricalProducts.brands.heading"),
    });
    expect(heading).toHaveAttribute("id", "electrical-brands-heading");
  });

  it("renders the localized categories in French", () => {
    const t = createTranslator("fr").t;
    setup("fr");
    expect(screen.getByText(t("electricalProducts.brands.sakoPower.category"))).toBeInTheDocument();
    expect(screen.getByText(t("electricalProducts.brands.hikvision.category"))).toBeInTheDocument();
  });
});
