import { describe, expect, it } from "vitest";

import { productPath } from "./product-path";
import { SOLAR_PACKAGES } from "@/lib/content/solar-packages";

/**
 * A product line links back to the surface that owns it.
 *
 * The store is scoped to Digital Marketing, so a solar package seeded under
 * Electrical Services would 404 if linked there. `productPath` routes a known
 * `KC-SOLAR-*` SKU to its package page and everything else to the store.
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

  it("links an ordinary product to the store", () => {
    expect(productPath("en", { slug: "thinkpad-x1", sku: "KC-DM-0001" })).toBe(
      "/en/digital-marketing/store/thinkpad-x1",
    );
  });

  it("falls back to the store when a SKU is absent", () => {
    expect(productPath("en", { slug: "something", sku: null })).toBe(
      "/en/digital-marketing/store/something",
    );
  });
});
