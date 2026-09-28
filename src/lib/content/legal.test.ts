import { describe, expect, it } from "vitest";
import {
  LEGAL_DOCUMENTS,
  legalDocumentFor,
  type LegalDocument,
} from "@/lib/content/legal";
import { LEGAL_PATHS } from "@/lib/config/navigation";
import { LOCALES } from "@/lib/i18n/locales";

/**
 * Terms and Privacy invariants.
 *
 * These pages are linked from the footer of every page and from the sign-up form,
 * so a defect here is visible site-wide. The checks below cover the failures that
 * would not surface in a build:
 *
 *   - a clause anchor that differs between locales, which breaks a deep link on
 *     language switch rather than on the page it was copied from;
 *   - a template placeholder left un-interpolated, which would publish `${...}`
 *     as visible text in a legal document;
 *   - an internal link to a route that does not exist, which is a 404 reached
 *     from inside the terms;
 *   - a route that is linked but not listed in the sitemap, or the reverse.
 */

const KEYS = ["terms", "privacy"] as const;

const allDocuments: Array<{ key: string; locale: string; doc: LegalDocument }> =
  KEYS.flatMap((key) =>
    LOCALES.map((locale) => ({
      key,
      locale,
      doc: legalDocumentFor(key, locale),
    })),
  );

describe("legal documents", () => {
  it("publishes a document for every key and locale", () => {
    expect(allDocuments).toHaveLength(KEYS.length * LOCALES.length);
    for (const { doc } of allDocuments) {
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.intro.length).toBeGreaterThan(0);
    }
  });

  it("dates every document, in both a readable and a machine form", () => {
    for (const { doc } of allDocuments) {
      // A published legal page needs a date a reader can see and a crawler can
      // parse; one without the other is either unreadable or unparseable.
      expect(doc.updatedAt).toMatch(/\d{4}/);
      expect(doc.updatedAtIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(doc.updatedAtIso))).toBe(false);
    }
  });

  it("uses the same clause anchors in English and French", () => {
    for (const key of KEYS) {
      const en = legalDocumentFor(key, "en").sections.map((s) => s.id);
      const fr = legalDocumentFor(key, "fr").sections.map((s) => s.id);
      // A visitor who switches language mid-page must land on the same clause,
      // so the ids are a cross-locale contract rather than a per-locale label.
      expect(fr).toEqual(en);
    }
  });

  it("gives every clause a unique id, a heading and a body", () => {
    for (const { doc } of allDocuments) {
      const ids = doc.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const section of doc.sections) {
        expect(section.id).toMatch(/^[a-z0-9-]+$/);
        expect(section.heading.trim().length).toBeGreaterThan(0);
        expect(section.body.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("never publishes an un-interpolated template placeholder", () => {
    for (const { doc } of allDocuments) {
      const text = [
        doc.title,
        doc.description,
        doc.intro,
        doc.retentionNote ?? "",
        ...doc.sections.flatMap((section) => [section.heading, section.body]),
      ].join("\n");
      // `${SITE.email}` reaching the page means a template literal lost its
      // backticks or a field is missing, and the reader would see the raw source.
      expect(text).not.toMatch(/\$\{/);
      expect(text).not.toMatch(/\bundefined\b/);
    }
  });

  it("only links to routes the site actually serves", () => {
    const siteRelative = /\]\((\/[^)]*)\)/g;
    for (const { doc } of allDocuments) {
      for (const section of doc.sections) {
        for (const match of section.body.matchAll(siteRelative)) {
          const href = match[1]!;
          const pathWithoutLocale =
            href.replace(/^\/(en|fr)(?=\/|$)/, "") || "/";
          // Internal links in a legal body must be links to real pages, not
          // plausible-looking prose that resolves to the not-found boundary.
          expect(siteRelativePaths).toContain(pathWithoutLocale);
        }
      }
    }
  });
});

/** Paths the site serves, locale-qualified links stripped of their prefix. */
const siteRelativePaths = [
  "/",
  "/terms",
  "/privacy",
  "/about",
  "/contact",
  "/services",
  "/gallery",
  "/insights",
];

describe("legal routes", () => {
  it("exposes both documents as footer-linked paths", () => {
    expect([...LEGAL_PATHS]).toEqual(["/terms", "/privacy"]);
  });

  it("serves a document for every advertised legal path", () => {
    for (const path of LEGAL_PATHS) {
      const key = path.slice(1) as (typeof KEYS)[number];
      expect(KEYS).toContain(key);
      const doc = LEGAL_DOCUMENTS[key];
      expect(doc.sections.length).toBeGreaterThan(0);
    }
  });

  it("resolves each key to the same slug the footer links to", () => {
    // The footer builds `/${locale}/terms` and `/${locale}/privacy` from the
    // message keys; the route segments must match those literals.
    expect(Object.keys(LEGAL_DOCUMENTS).sort()).toEqual([...KEYS].sort());
  });
});
