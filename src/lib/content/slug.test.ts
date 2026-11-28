import { describe, expect, it, vi } from "vitest";

import { slugifyTitle, uniqueSlug } from "./slug";

describe("slugifyTitle", () => {
  it("lowercases, strips accents and hyphenates", () => {
    expect(slugifyTitle("L'École Moderne — Buea", "listing")).toBe(
      "lecole-moderne-buea",
    );
  });

  it("collapses repeated separators and trims them", () => {
    expect(slugifyTitle("  Solar / Battery   Package  ", "product")).toBe(
      "solar-battery-package",
    );
  });

  it("falls back when the title has no usable characters", () => {
    expect(slugifyTitle("!!!", "listing")).toBe("listing");
  });

  it("keeps the result inside the requested limit", () => {
    const slug = slugifyTitle("a ".repeat(200), "product", 120);
    expect(slug.length).toBeLessThanOrEqual(120);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("keeps the first free candidate", async () => {
    const exists = vi.fn().mockResolvedValue(false);
    await expect(uniqueSlug("house-in-buea", exists)).resolves.toBe(
      "house-in-buea",
    );
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it("adds a numeric suffix until a candidate is free", async () => {
    const exists = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(uniqueSlug("house-in-buea", exists)).resolves.toBe(
      "house-in-buea-3",
    );
  });
});
