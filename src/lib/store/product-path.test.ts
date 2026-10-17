import { describe, expect, it } from "vitest";

import { cartPathFor, productPath } from "./product-path";
import { SOLAR_PACKAGES } from "@/lib/content/solar-packages";

/**
 * A product line links back to the surface that owns it.
 *
 * The detail route is `/{locale}/{department}/store/{category}/{slug}`, so a
 * line must carry its department and category. `productPath` routes a known
 * `KC-SOLAR-*` SKU to its package page and everything else to its department
 * store.
 */
describe("productPath", () => {
  it("links a solar package to its package page", () => {
    const pkg = SOLAR_PACKAGES[0];
    expect(pkg).toBeDefined();
    expect(productPath("en", { slug: pkg!.id, sku: pkg!.sku })).toBe(
      `/en/electrical-services/packages/${pkg!.id}`,
    );
  });

  it("links a package for every seeded SKU", () => {
    for (const pkg of SOLAR_PACKAGES) {
      expect(productPath("fr", { slug: pkg.id, sku: pkg.sku })).toContain(
        `/fr/electrical-services/packages/${pkg.id}`,
      );
    }
  });

  it("links an ordinary product to its department store detail page", () => {
    expect(
      productPath("en", {
        slug: "thinkpad-x1",
        sku: "KC-DM-0001",
        categorySlug: "laptops",
        departmentSlug: "digital-marketing",
      }),
    ).toBe("/en/digital-marketing/store/laptops/thinkpad-x1");
  });

  it("honours a non-default department", () => {
    expect(
      productPath("en", {
        slug: "home-3kva",
        sku: "KC-SOLAR-HOME-3KVA",
        categorySlug: "medium-home",
        departmentSlug: "electrical-services",
      }),
    ).toBe("/en/electrical-services/packages/home-3kva");
  });

  it("falls back to the department store when the category is unknown", () => {
    expect(
      productPath("en", {
        slug: "something",
        sku: null,
        departmentSlug: "digital-marketing",
      }),
    ).toBe("/en/digital-marketing/store");
  });

  it("falls back to the Digital Marketing store when nothing is known", () => {
    expect(productPath("en", { slug: "something", sku: null })).toBe(
      "/en/digital-marketing/store",
    );
  });
});

/**
 * The cart path names a department, because the cart route is
 * `/{locale}/{department}/store/cart`. The header resolves the department from
 * the cart's first line and falls back to the default store before that is known.
 */
describe("cartPathFor", () => {
  it("uses the department the cart belongs to", () => {
    expect(cartPathFor("en", "electrical-services")).toBe(
      "/en/electrical-services/store/cart",
    );
    expect(cartPathFor("fr", "real-estate")).toBe(
      "/fr/real-estate/store/cart",
    );
  });

  it("falls back to the Digital Marketing store when no department is known", () => {
    expect(cartPathFor("en")).toBe("/en/digital-marketing/store/cart");
    expect(cartPathFor("en", null)).toBe("/en/digital-marketing/store/cart");
  });
});
