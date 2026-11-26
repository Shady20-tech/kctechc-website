import { describe, expect, it } from "vitest";

import { isBundledPublicPath, isStorageObjectPath } from "./object-path";

describe("isStorageObjectPath", () => {
  it("accepts a normal bucket-relative object path", () => {
    expect(isStorageObjectPath("products/abc/photo.jpg")).toBe(true);
    expect(isStorageObjectPath("avatars/user-1.png")).toBe(true);
    expect(isStorageObjectPath("listings/abc/one.webp")).toBe(true);
  });

  it("rejects an absolute URL, including the reported imgur value", () => {
    expect(isStorageObjectPath("https://imgur.com/undefined")).toBe(false);
    expect(isStorageObjectPath("https://example.com/photo.jpg")).toBe(false);
    expect(isStorageObjectPath("//cdn.example.com/photo.jpg")).toBe(false);
  });

  it("rejects traversal, a leading slash and empty values", () => {
    expect(isStorageObjectPath("../secret.jpg")).toBe(false);
    expect(isStorageObjectPath("/products/photo.jpg")).toBe(false);
    expect(isStorageObjectPath("")).toBe(false);
    expect(isStorageObjectPath("   ")).toBe(false);
    expect(isStorageObjectPath(null)).toBe(false);
    expect(isStorageObjectPath(undefined)).toBe(false);
  });
});

describe("isBundledPublicPath", () => {
  it("accepts a root-relative public asset", () => {
    expect(
      isBundledPublicPath("/products/electrical/sako-solar-system.jpg"),
    ).toBe(true);
  });

  it("rejects an external URL so it cannot reach next/image", () => {
    expect(isBundledPublicPath("https://imgur.com/undefined")).toBe(false);
    expect(isBundledPublicPath("//imgur.com/undefined")).toBe(false);
    expect(isBundledPublicPath("products/photo.jpg")).toBe(false);
  });
});
