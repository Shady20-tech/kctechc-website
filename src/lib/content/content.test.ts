import { describe, expect, it } from "vitest";
import {
  allServiceRecords,
  departmentHasServices,
  localizeService,
  serviceRecordsFor,
} from "@/lib/content/defaults";
import { SERVICE_TRANSLATIONS_FR } from "@/lib/content/services.fr";
import { resolveLocalized } from "@/lib/content/types";
import { SERVICE_SLUGS } from "@/lib/content/service-slugs";

describe("resolveLocalized", () => {
  const canonical = {
    title: "Canonical title",
    summary: "Canonical summary",
    deliveryNotes: undefined as string | undefined,
  };

  it("uses the translation for a field that has one", () => {
    const { value, hasFallback } = resolveLocalized(canonical, {
      title: "Titre",
    });

    expect(value.title).toBe("Titre");
    expect(value.summary).toBe("Canonical summary");
    expect(hasFallback).toBe(true);
  });

  it("treats a whitespace-only translation as absent, not as a blank value", () => {
    // An empty string in the database must not render an empty heading.
    const { value } = resolveLocalized(canonical, { title: "   " });

    expect(value.title).toBe("Canonical title");
  });

  it("treats an empty list translation as absent", () => {
    const { value } = resolveLocalized(
      { features: ["one", "two"] },
      { features: [] },
    );

    expect(value.features).toEqual(["one", "two"]);
  });

  it("does not count an optional field absent everywhere as a fallback", () => {
    // `deliveryNotes` has no canonical content either, so nothing was lost.
    const { hasFallback } = resolveLocalized(
      { title: "A", deliveryNotes: undefined },
      { title: "Un" },
    );

    expect(hasFallback).toBe(false);
  });

  it("reports a fallback when no overlay exists at all", () => {
    const { value, hasFallback } = resolveLocalized(canonical, undefined);

    expect(value).toEqual(canonical);
    expect(hasFallback).toBe(true);
  });
});

describe("service catalogue", () => {
  const records = allServiceRecords();

  it("contains the nine Digital Marketing service areas", () => {
    expect(records).toHaveLength(9);
    expect(records.map((record) => record.slug).sort()).toEqual(
      [...SERVICE_SLUGS].sort(),
    );
  });

  it("belongs entirely to the digital marketing department", () => {
    for (const record of records) {
      expect(record.department).toBe("digital-marketing");
    }
  });

  it("has unique slugs in a URL-safe format", () => {
    const slugs = records.map((record) => record.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("supplies non-empty required content for every service", () => {
    for (const record of records) {
      expect(record.title.trim().length).toBeGreaterThan(0);
      expect(record.summary.trim().length).toBeGreaterThan(0);
      expect(record.description.trim().length).toBeGreaterThan(0);
      expect(record.features.length).toBeGreaterThan(0);
    }
  });

  it("supplies a French overlay for every service, covering every field", () => {
    for (const record of records) {
      const overlay = SERVICE_TRANSLATIONS_FR[record.slug];
      expect(overlay, `missing fr overlay for ${record.slug}`).toBeDefined();
      if (!overlay) continue;
      expect(overlay.title?.trim()).toBeTruthy();
      expect(overlay.summary?.trim()).toBeTruthy();
      expect(overlay.description?.trim()).toBeTruthy();
      expect(overlay.features?.length).toBeGreaterThan(0);
      expect(overlay.faqs?.length).toBeGreaterThan(0);
    }
  });

  it("localizes to French without falling back", () => {
    for (const record of records) {
      const localized = localizeService(record, "fr");
      expect(localized.hasFallback, `${record.slug} fell back`).toBe(false);
      expect(localized.title).not.toBe(record.title);
    }
  });

  it("returns English canonical text for en", () => {
    const record = records[0]!;
    const localized = localizeService(record, "en");
    expect(localized.title).toBe(record.title);
  });

  it("makes no unverifiable numeric claim about the company", () => {
    // Guards the content rule: no invented client counts, years of trading,
    // prices or percentages. Digits may only appear in generic contexts.
    for (const record of records) {
      const text = [record.summary, record.description].join(" ");
      expect(text).not.toMatch(/\b\d+\s*(years?|clients?|projects?|%)\b/i);
      expect(text).not.toMatch(/\bFCFA\b|\bXAF\s?\d/i);
    }
  });
});

describe("department capability gate", () => {
  it("enables services for digital marketing", () => {
    expect(departmentHasServices("digital-marketing")).toBe(true);
  });

  it("keeps the surface closed for departments whose content is a later phase", () => {
    expect(departmentHasServices("electrical-services")).toBe(false);
    expect(departmentHasServices("real-estate")).toBe(false);
  });

  it("returns no records for a department without services", () => {
    expect(serviceRecordsFor("electrical-services")).toEqual([]);
  });
});
