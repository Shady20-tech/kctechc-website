import { describe, expect, it, vi } from "vitest";

import { SOLAR_PACKAGES } from "@/lib/content/solar-packages";
import {
  productImageSrc,
  seededImage,
  storagePublicUrl,
} from "@/lib/store/storage";

/**
 * The seeded solar packages carry a `product_media` row so they satisfy the
 * publish-requires-media rule, but their `storage_path` is a placeholder that is
 * never uploaded. Resolving it as a Storage URL produced a 400 from the image
 * optimizer and a broken-image box on every store card, gallery and cart line for
 * a package. These tests pin the resolution order that fixes it.
 */
describe("seededImage", () => {
  it("resolves every seeded package SKU to its bundled image", () => {
    for (const pkg of SOLAR_PACKAGES) {
      expect(seededImage(pkg.sku)).toBe(pkg.image);
    }
  });

  it("returns null for a non-package SKU or a missing one", () => {
    expect(seededImage("KC-OTHER-123")).toBeNull();
    expect(seededImage(null)).toBeNull();
    expect(seededImage(undefined)).toBeNull();
  });
});

describe("productImageSrc", () => {
  it("prefers the bundled image for a seeded package over its placeholder path", () => {
    const pkg = SOLAR_PACKAGES[0]!;
    const src = productImageSrc(
      { storagePath: `electrical/packages/${pkg.id}.jpg` },
      pkg.sku,
    );
    expect(src).toBe(pkg.image);
    expect(src).not.toContain("storage/v1");
  });

  it("uses the Storage URL for an ordinary product", () => {
    const path = "products/abc/photo.jpg";
    const src = productImageSrc({ storagePath: path }, "KC-LAPTOP-1");
    // It resolves through Storage, not through the bundled-package table — the
    // property that matters. Asserting `null` here instead would only be true
    // while Supabase is unconfigured, so it would fail in any environment that
    // sets the URL (as this container does) without anything being wrong.
    expect(src).toBe(storagePublicUrl(path));
    expect(seededImage("KC-LAPTOP-1")).toBeNull();
    // A non-package product never gets a bundled public path.
    expect(src?.startsWith("/") ?? false).toBe(false);
  });

  it("returns null rather than a broken URL when Storage is unconfigured", async () => {
    vi.resetModules();
    vi.doMock("@/lib/config/env", () => ({
      publicEnv: { supabaseUrl: "" },
      getSupabaseConfig: () => null,
      isSupabaseConfigured: () => false,
    }));
    try {
      const { storagePublicUrl: unconfigured } =
        await import("@/lib/store/storage");
      expect(unconfigured("products/abc/photo.jpg")).toBeNull();
    } finally {
      vi.doUnmock("@/lib/config/env");
      vi.resetModules();
    }
  });

  it("returns a public path verbatim when one is set", () => {
    const src = productImageSrc({
      storagePath: null,
      publicPath: "/products/electrical/sako-solar-system.jpg",
    });
    expect(src).toBe("/products/electrical/sako-solar-system.jpg");
  });

  it("returns null when nothing resolves", () => {
    expect(productImageSrc({ storagePath: null })).toBeNull();
    expect(productImageSrc({ storagePath: null }, "KC-LAPTOP-1")).toBeNull();
  });
});
