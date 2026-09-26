import { describe, expect, it } from "vitest";
import {
  buildTranslationEntries,
  buildTranslationKey,
  markOutdatedAfterSourceChange,
  resolveLocalizedValue,
} from "@/lib/i18n/dynamic-translation";

describe("buildTranslationKey", () => {
  it("is deterministic for the same input", () => {
    const draft = {
      entityType: "product" as const,
      entityId: "abc-123",
      fieldName: "name",
    };
    expect(buildTranslationKey(draft)).toBe(
      buildTranslationKey({ ...draft }),
    );
  });

  it("composes entity type, id and field", () => {
    expect(
      buildTranslationKey({
        entityType: "property_listing",
        entityId: "listing-1",
        fieldName: "title",
      }),
    ).toBe("property_listing.listing-1.title");
  });
});

describe("buildTranslationEntries", () => {
  const now = "2026-01-01T00:00:00.000Z";

  it("creates one entry per non-source target locale", () => {
    const entries = buildTranslationEntries(
      [
        {
          entityType: "product",
          entityId: "p1",
          fieldName: "name",
          sourceLocale: "en",
          targetLocales: ["en", "fr"],
        },
      ],
      now,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.translationKey).toBe("product.p1.name.fr");
    expect(entries[0]?.state).toBe("pending");
    expect(entries[0]?.syncState).toBe("queued");
    expect(entries[0]?.sourceLocale).toBe("en");
  });

  it("creates nothing when the only target is the source locale", () => {
    const entries = buildTranslationEntries(
      [
        {
          entityType: "product",
          entityId: "p1",
          fieldName: "name",
          sourceLocale: "en",
          targetLocales: ["en"],
        },
      ],
      now,
    );
    expect(entries).toHaveLength(0);
  });

  it("expands multiple fields across multiple locales", () => {
    const entries = buildTranslationEntries(
      [
        {
          entityType: "property_listing",
          entityId: "l1",
          fieldName: "title",
          sourceLocale: "en",
          targetLocales: ["fr"],
        },
        {
          entityType: "property_listing",
          entityId: "l1",
          fieldName: "description",
          sourceLocale: "en",
          targetLocales: ["fr"],
        },
      ],
      now,
    );
    expect(entries.map((entry) => entry.translationKey)).toEqual([
      "property_listing.l1.title.fr",
      "property_listing.l1.description.fr",
    ]);
  });

  it("produces ids equal to the translation key so retries are idempotent", () => {
    const entries = buildTranslationEntries(
      [
        {
          entityType: "insight",
          entityId: "i1",
          fieldName: "summary",
          sourceLocale: "en",
          targetLocales: ["fr"],
        },
      ],
      now,
    );
    expect(entries[0]?.id).toBe(entries[0]?.translationKey);
  });
});

describe("markOutdatedAfterSourceChange", () => {
  it("flags an existing translation as outdated", () => {
    expect(markOutdatedAfterSourceChange("translated")).toBe("outdated");
    expect(markOutdatedAfterSourceChange("reviewed")).toBe("outdated");
  });

  it("leaves a missing translation as missing", () => {
    expect(markOutdatedAfterSourceChange("missing")).toBe("missing");
  });
});

describe("resolveLocalizedValue", () => {
  const source = { locale: "en" as const, value: "Solar panel" };

  it("returns the requested translation when present", () => {
    const result = resolveLocalizedValue(
      { locale: "fr", value: "Panneau solaire", state: "translated" },
      source,
    );
    expect(result).toEqual({
      locale: "fr",
      value: "Panneau solaire",
      isFallback: false,
    });
  });

  it("falls back to the source when the translation is missing", () => {
    const result = resolveLocalizedValue(
      { locale: "fr", value: null, state: "missing" },
      source,
    );
    expect(result).toEqual({
      locale: "en",
      value: "Solar panel",
      isFallback: true,
    });
  });

  it("falls back when the stored value is only whitespace", () => {
    const result = resolveLocalizedValue(
      { locale: "fr", value: "   ", state: "translated" },
      source,
    );
    expect(result.isFallback).toBe(true);
    expect(result.value).toBe("Solar panel");
  });
});
