import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  publicEnv: { supabaseUrl: "https://example.supabase.co" },
}));

import { listingMediaPath, propertyMediaPublicUrl } from "./storage";

/**
 * The listing-image path builder.
 *
 * The bug this guards against is a collision, not a cosmetic one: the previous
 * implementation named objects by their position in the gallery (`000.jpg`),
 * so deleting the first image and uploading another reused the same path and
 * overwrote a live object. These tests pin the two properties that prevent it —
 * the caller-supplied name is preserved, and distinct names stay distinct.
 */
describe("listingMediaPath", () => {
  const listingId = "7c1f2f5e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

  it("preserves the caller's base name so uploads cannot collide", () => {
    const first = listingMediaPath(listingId, "a0000000-0000-4000-8000-000000000001.jpg");
    const second = listingMediaPath(listingId, "b0000000-0000-4000-8000-000000000002.jpg");

    expect(first).not.toBe(second);
    expect(first).toBe(
      `${listingId}/a0000000-0000-4000-8000-000000000001.jpg`,
    );
  });

  it("namespaces by listing id", () => {
    const path = listingMediaPath(listingId, "photo.png");
    expect(path.startsWith(`${listingId}/`)).toBe(true);
  });

  it("sanitizes the base name rather than trusting it", () => {
    const path = listingMediaPath(listingId, "../etc/passwd.png");
    expect(path).not.toContain("..");
    expect(path).not.toContain("/etc/");
    // Each disallowed character becomes one dash, so `../` is three of them.
    expect(path).toBe(`${listingId}/---etc-passwd.png`);
  });

  it("falls back to a safe extension when the detected one is unusable", () => {
    expect(listingMediaPath(listingId, "image.notanext")).toBe(
      `${listingId}/image.jpg`,
    );
    expect(listingMediaPath(listingId, "image")).toBe(`${listingId}/image.jpg`);
  });
});

describe("propertyMediaPublicUrl", () => {
  it("builds the public bucket URL from the object path", () => {
    expect(propertyMediaPublicUrl("abc/one.jpg")).toBe(
      "https://example.supabase.co/storage/v1/object/public/property-media/abc/one.jpg",
    );
  });

  it("returns null for an empty path rather than a broken URL", () => {
    expect(propertyMediaPublicUrl("")).toBeNull();
    expect(propertyMediaPublicUrl("///")).toBeNull();
  });
});
