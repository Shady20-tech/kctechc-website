import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  publicEnv: { supabaseUrl: "https://example.supabase.co" },
}));

import { publicBucketUrl } from "./media";

describe("publicBucketUrl", () => {
  it("builds a public URL from a bucket-relative path", () => {
    expect(publicBucketUrl("avatars", "user-1/photo.jpg")).toBe(
      "https://example.supabase.co/storage/v1/object/public/avatars/user-1/photo.jpg",
    );
  });

  it("returns null instead of a broken URL for an external image reference", () => {
    expect(
      publicBucketUrl("avatars", "https://imgur.com/undefined"),
    ).toBeNull();
    expect(
      publicBucketUrl("content-media", "https://imgur.com/undefined"),
    ).toBeNull();
    expect(
      publicBucketUrl("product-media", "https://imgur.com/undefined"),
    ).toBeNull();
  });

  it("returns null for an empty or traversal path", () => {
    expect(publicBucketUrl("avatars", "")).toBeNull();
    expect(publicBucketUrl("avatars", "../photo.jpg")).toBeNull();
  });
});
