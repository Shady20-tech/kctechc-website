import { describe, expect, it } from "vitest";
import { localizeCategory, localizeProduct } from "@/lib/store/defaults";
import type { CategoryRecord, ProductRecord } from "@/lib/store/types";

const BASE_PRODUCT: ProductRecord = {
  id: "p1",
  categorySlug: "laptops",
  slug: "thinkpad-x1",
  sku: "KC-LAP-01",
  title: "ThinkPad X1 Carbon",
  shortDescription: "A lightweight business laptop.",
  description: "Full description.",
  specifications: [{ label: "Weight", value: "1.1 kg" }],
  priceMinor: 850000,
  currency: "XAF",
  stock: 4,
  availability: "in_stock",
  condition: "new",
  images: [],
};

describe("localizeProduct", () => {
  it("returns the canonical text for the source locale", () => {
    const localized = localizeProduct(BASE_PRODUCT, "en");
    expect(localized.title).toBe("ThinkPad X1 Carbon");
    expect(localized.hasFallback).toBe(false);
  });

  it("uses the translated text when one exists", () => {
    const localized = localizeProduct(
      {
        ...BASE_PRODUCT,
        localizedSlugs: { fr: "ordinateur-thinkpad-x1" },
        translations: {
          fr: {
            title: "Ordinateur ThinkPad X1 Carbon",
            shortDescription: "Un ordinateur portable léger.",
            description: "Description complète.",
            specifications: [{ label: "Poids", value: "1,1 kg" }],
          },
        },
      },
      "fr",
    );

    expect(localized.title).toBe("Ordinateur ThinkPad X1 Carbon");
    expect(localized.shortDescription).toBe("Un ordinateur portable léger.");
    expect(localized.specifications[0]?.label).toBe("Poids");
    expect(localized.hasFallback).toBe(false);
  });

  it("uses the localized slug as the URL slug", () => {
    const localized = localizeProduct(
      {
        ...BASE_PRODUCT,
        localizedSlugs: { fr: "ordinateur-thinkpad-x1" },
      },
      "fr",
    );
    expect(localized.slug).toBe("ordinateur-thinkpad-x1");
  });

  it("falls back to the canonical slug when no French slug exists", () => {
    expect(localizeProduct(BASE_PRODUCT, "fr").slug).toBe("thinkpad-x1");
  });

  it("falls back per field and flags the fallback", () => {
    const localized = localizeProduct(
      {
        ...BASE_PRODUCT,
        translations: {
          fr: { title: "Titre traduit" },
        },
      },
      "fr",
    );

    // The title is translated, so it is used...
    expect(localized.title).toBe("Titre traduit");
    // ...while the description has no translation and falls back.
    expect(localized.shortDescription).toBe(BASE_PRODUCT.shortDescription);
    expect(localized.description).toBe(BASE_PRODUCT.description);
    // The page needs to know a fallback happened so it can say so.
    expect(localized.hasFallback).toBe(true);
  });

  it("does not flag a fallback when the overlay is complete", () => {
    const localized = localizeProduct(
      {
        ...BASE_PRODUCT,
        translations: {
          fr: {
            title: "Titre",
            shortDescription: "Résumé",
            description: "Description",
            specifications: [{ label: "Poids", value: "1,1 kg" }],
          },
        },
      },
      "fr",
    );
    expect(localized.hasFallback).toBe(false);
  });

  it("treats a blank translation as absent", () => {
    const localized = localizeProduct(
      {
        ...BASE_PRODUCT,
        translations: { fr: { title: "   " } },
      },
      "fr",
    );
    expect(localized.title).toBe(BASE_PRODUCT.title);
    expect(localized.hasFallback).toBe(true);
  });

  it("does not flag a fallback for an optional field absent everywhere", () => {
    // A product with no SEO description is not a translation gap.
    const localized = localizeProduct(
      { ...BASE_PRODUCT, specifications: [] },
      "fr",
    );
    expect(localized.hasFallback).toBe(true); // description fields still missing
    const complete = localizeProduct(
      {
        ...BASE_PRODUCT,
        specifications: [],
        translations: {
          fr: { title: "T", shortDescription: "S", description: "D" },
        },
      },
      "fr",
    );
    expect(complete.hasFallback).toBe(false);
  });

  it("carries price, stock and availability through unchanged", () => {
    const localized = localizeProduct(
      {
        ...BASE_PRODUCT,
        priceMinor: 999,
        stock: 0,
        availability: "out_of_stock",
      },
      "fr",
    );
    // Price and stock are commercial facts, not translated content.
    expect(localized.priceMinor).toBe(999);
    expect(localized.stock).toBe(0);
    expect(localized.availability).toBe("out_of_stock");
  });

  it("selects the locale's SEO overlay", () => {
    const localized = localizeProduct(
      {
        ...BASE_PRODUCT,
        seo: {
          en: { title: "English SEO" },
          fr: { title: "SEO français" },
        },
      },
      "fr",
    );
    expect(localized.seo.title).toBe("SEO français");
  });
});

describe("localizeCategory", () => {
  const CATEGORY: CategoryRecord = {
    slug: "laptops",
    name: "Laptops",
    description: "Portable computers.",
  };

  it("returns the canonical text for the source locale", () => {
    const localized = localizeCategory(CATEGORY, "en");
    expect(localized.name).toBe("Laptops");
    expect(localized.slug).toBe("laptops");
  });

  it("uses the translated name and localized slug", () => {
    const localized = localizeCategory(
      {
        ...CATEGORY,
        localizedSlugs: { fr: "ordinateurs" },
        translations: {
          fr: { name: "Ordinateurs", description: "Ordinateurs portables." },
        },
      },
      "fr",
    );
    expect(localized.name).toBe("Ordinateurs");
    expect(localized.description).toBe("Ordinateurs portables.");
    expect(localized.slug).toBe("ordinateurs");
  });

  it("falls back to the canonical name and slug", () => {
    const localized = localizeCategory(CATEGORY, "fr");
    expect(localized.name).toBe("Laptops");
    expect(localized.slug).toBe("laptops");
  });

  it("treats a blank translated name as absent", () => {
    const localized = localizeCategory(
      { ...CATEGORY, translations: { fr: { name: "  " } } },
      "fr",
    );
    expect(localized.name).toBe("Laptops");
  });
});
