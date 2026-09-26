import { describe, expect, it } from "vitest";
import {
  buildProductTranslationKeys,
  buildTranslationKey,
  entityIdFromTranslationKey,
  isTranslationKey,
  localeFromTranslationKey,
  PRODUCT_TRANSLATABLE_FIELDS,
} from "@/lib/translation/keys";

const PRODUCT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("buildTranslationKey", () => {
  it("produces the documented four-segment format", () => {
    expect(buildTranslationKey("product", PRODUCT_ID, "name", "en")).toBe(
      `product.${PRODUCT_ID}.name.en`,
    );
  });

  it("is deterministic: the same inputs always produce the same key", () => {
    const first = buildTranslationKey(
      "product",
      PRODUCT_ID,
      "description",
      "fr",
    );
    const second = buildTranslationKey(
      "product",
      PRODUCT_ID,
      "description",
      "fr",
    );
    // Determinism is what makes regeneration idempotent — a re-save must update
    // one key rather than create a second one for the same field.
    expect(first).toBe(second);
  });

  it("distinguishes locale, field and entity", () => {
    const base = buildTranslationKey("product", PRODUCT_ID, "name", "en");
    expect(buildTranslationKey("product", PRODUCT_ID, "name", "fr")).not.toBe(
      base,
    );
    expect(
      buildTranslationKey("product", PRODUCT_ID, "description", "en"),
    ).not.toBe(base);
    expect(
      buildTranslationKey(
        "product",
        "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
        "name",
        "en",
      ),
    ).not.toBe(base);
  });

  it("produces a key the format guard accepts", () => {
    expect(
      isTranslationKey(
        buildTranslationKey("product", PRODUCT_ID, "name", "en"),
      ),
    ).toBe(true);
  });
});

describe("buildProductTranslationKeys", () => {
  it("covers every translatable field for one locale", () => {
    const keys = buildProductTranslationKeys(PRODUCT_ID, "en");
    expect(keys).toHaveLength(PRODUCT_TRANSLATABLE_FIELDS.length);
    for (const field of PRODUCT_TRANSLATABLE_FIELDS) {
      expect(keys).toContain(`product.${PRODUCT_ID}.${field}.en`);
    }
  });

  it("narrows to the fields the caller names", () => {
    const keys = buildProductTranslationKeys(PRODUCT_ID, "en", [
      "name",
      "slug",
    ]);
    expect(keys).toEqual([
      `product.${PRODUCT_ID}.name.en`,
      `product.${PRODUCT_ID}.slug.en`,
    ]);
  });

  it("does not repeat a key", () => {
    const keys = buildProductTranslationKeys(PRODUCT_ID, "fr");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("isTranslationKey", () => {
  it("rejects a malformed key", () => {
    for (const value of [
      "",
      "product",
      "product.name",
      "product.not-a-uuid.name.en",
      "product.3f2504e0-4f89-41d3-9a0c-0305e82c3301.name",
      "product.3f2504e0-4f89-41d3-9a0c-0305e82c3301.name.english",
      "Product.3f2504e0-4f89-41d3-9a0c-0305e82c3301.name.en",
    ]) {
      expect(isTranslationKey(value), value).toBe(false);
    }
  });

  it("accepts the generated format", () => {
    expect(isTranslationKey(`product.${PRODUCT_ID}.seo_title.fr`)).toBe(true);
  });
});

describe("key segment readers", () => {
  it("reads the locale back out of a key", () => {
    expect(localeFromTranslationKey(`product.${PRODUCT_ID}.name.fr`)).toBe(
      "fr",
    );
  });

  it("reads the entity id back out of a key", () => {
    expect(entityIdFromTranslationKey(`product.${PRODUCT_ID}.name.fr`)).toBe(
      PRODUCT_ID,
    );
  });

  it("returns null for a malformed key rather than a partial value", () => {
    expect(localeFromTranslationKey("product.name")).toBeNull();
    expect(entityIdFromTranslationKey("product.name")).toBeNull();
    expect(localeFromTranslationKey("")).toBeNull();
  });
});
