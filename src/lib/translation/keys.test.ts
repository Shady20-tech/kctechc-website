import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  buildInsightTranslationKeys,
  buildProductTranslationKeys,
  buildTranslationKey,
  entityIdFromTranslationKey,
  INSIGHT_TRANSLATABLE_FIELDS,
  isTranslationKey,
  localeFromTranslationKey,
  PRODUCT_TRANSLATABLE_FIELDS,
} from "@/lib/translation/keys";

const PRODUCT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const INSIGHT_ID = "8b1d6f42-9c3a-4e77-b2f1-5d6c7a8e9f01";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/**
 * Read a migration as text.
 *
 * Deliberately not a database connection — a unit test should not require a
 * running Postgres — so the parse is simple and must stay simple. This is the same
 * approach `enums.test.ts` uses to keep the TypeScript enum mirrors in step with
 * the migrations.
 */
function readMigration(nameFragment: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) =>
    f.includes(nameFragment),
  );
  if (!file) {
    throw new Error(
      `No migration matching "${nameFragment}" in ${MIGRATIONS_DIR}`,
    );
  }
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

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

describe("buildInsightTranslationKeys", () => {
  it("covers every translatable article field for one locale", () => {
    const keys = buildInsightTranslationKeys(INSIGHT_ID, "en");
    expect(keys).toHaveLength(INSIGHT_TRANSLATABLE_FIELDS.length);
    for (const field of INSIGHT_TRANSLATABLE_FIELDS) {
      expect(keys).toContain(`insight.${INSIGHT_ID}.${field}.en`);
    }
  });

  it("produces a key the format guard accepts", () => {
    for (const key of buildInsightTranslationKeys(INSIGHT_ID, "fr")) {
      expect(isTranslationKey(key), key).toBe(true);
    }
  });

  it("does not repeat a key", () => {
    const keys = buildInsightTranslationKeys(INSIGHT_ID, "fr");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("insight translatable fields match the migration", () => {
  it("matches insight_translatable_fields() in the migration", () => {
    const sql = readMigration("insight_translation_index");
    const fn = sql.match(
      /create or replace function public\.insight_translatable_fields\(\)[\s\S]*?select array\[([^\]]*)\]/i,
    );
    const fieldList = fn?.[1];
    expect(fieldList, "insight_translatable_fields() not found").toBeDefined();

    const fields: string[] = [];
    for (const match of (fieldList as string).matchAll(/'([^']+)'/g)) {
      if (match[1]) fields.push(match[1]);
    }

    expect([...INSIGHT_TRANSLATABLE_FIELDS].sort()).toEqual(fields.sort());
  });

  it("indexes exactly the fields the article page can render in French", () => {
    // `localizeInsight` merges title/summary/body only. Indexing a field the read
    // path ignores would create Tolgee keys nothing consumes, and omitting one it
    // reads would leave that field permanently English.
    expect([...INSIGHT_TRANSLATABLE_FIELDS].sort()).toEqual([
      "body",
      "summary",
      "title",
    ]);
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
