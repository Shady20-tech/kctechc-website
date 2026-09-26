import { describe, expect, it } from "vitest";
import {
  isCanonicalUrlSlug,
  normalizeSlug,
  resolveBySlug,
  slugForLocale,
  slugsForLocale,
} from "@/lib/store/slug-resolution";

const THINKPAD = {
  id: "p1",
  slug: "thinkpad-x1",
  localizedSlugs: { fr: "ordinateur-thinkpad-x1" },
};

const NO_FRENCH = {
  id: "p2",
  slug: "usb-c-hub",
  localizedSlugs: {},
};

describe("normalizeSlug", () => {
  it("lowercases and trims", () => {
    expect(normalizeSlug("  ThinkPad-X1  ")).toBe("thinkpad-x1");
  });
});

describe("slugForLocale", () => {
  it("uses the localized slug for a target locale", () => {
    expect(slugForLocale(THINKPAD, "fr")).toBe("ordinateur-thinkpad-x1");
  });

  it("uses the canonical slug for the source locale", () => {
    expect(slugForLocale(THINKPAD, "en")).toBe("thinkpad-x1");
  });

  it("falls back to the canonical slug when no translation exists", () => {
    // Without this fallback a product published before its French slug was
    // written would 404 for a French visitor following an English link.
    expect(slugForLocale(NO_FRENCH, "fr")).toBe("usb-c-hub");
  });

  it("treats a blank localized slug as absent", () => {
    expect(
      slugForLocale({ slug: "widget", localizedSlugs: { fr: "   " } }, "fr"),
    ).toBe("widget");
  });
});

describe("resolveBySlug", () => {
  const records = [THINKPAD, NO_FRENCH];

  it("resolves the English slug under en", () => {
    expect(resolveBySlug(records, "thinkpad-x1", "en")?.id).toBe("p1");
  });

  it("resolves the French slug under fr", () => {
    expect(resolveBySlug(records, "ordinateur-thinkpad-x1", "fr")?.id).toBe(
      "p1",
    );
  });

  it("still resolves the canonical slug under fr", () => {
    // The English slug keeps working under /fr, so an inbound English link is
    // not broken for a French visitor.
    expect(resolveBySlug(records, "thinkpad-x1", "fr")?.id).toBe("p1");
  });

  it("does NOT resolve the French slug under en", () => {
    // Scoping to the locale is what prevents two URLs for one product. If the
    // French slug answered under /en, the canonical English page would have a
    // duplicate at a second address.
    expect(resolveBySlug(records, "ordinateur-thinkpad-x1", "en")).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(resolveBySlug(records, "THINKPAD-X1", "en")?.id).toBe("p1");
  });

  it("returns null for an unknown slug", () => {
    expect(resolveBySlug(records, "no-such-product", "en")).toBeNull();
  });

  it("returns null for an empty slug", () => {
    expect(resolveBySlug(records, "", "en")).toBeNull();
    expect(resolveBySlug(records, "   ", "en")).toBeNull();
  });
});

describe("isCanonicalUrlSlug", () => {
  it("is true when the segment is the locale's own slug", () => {
    expect(isCanonicalUrlSlug(THINKPAD, "thinkpad-x1", "en")).toBe(true);
    expect(isCanonicalUrlSlug(THINKPAD, "ordinateur-thinkpad-x1", "fr")).toBe(
      true,
    );
  });

  it("is false when the segment is the canonical slug under a target locale", () => {
    // This is the signal the page uses to redirect to the French URL rather than
    // serving the same product at a second address.
    expect(isCanonicalUrlSlug(THINKPAD, "thinkpad-x1", "fr")).toBe(false);
  });

  it("is true when there is no localized slug to prefer", () => {
    expect(isCanonicalUrlSlug(NO_FRENCH, "usb-c-hub", "fr")).toBe(true);
  });
});

describe("slugsForLocale", () => {
  it("lists both the canonical and localized slug so both are prerenderable", () => {
    expect(slugsForLocale(THINKPAD, "fr").sort()).toEqual(
      ["ordinateur-thinkpad-x1", "thinkpad-x1"].sort(),
    );
  });

  it("does not repeat a slug when the localized one equals the canonical", () => {
    expect(
      slugsForLocale(
        { slug: "widget", localizedSlugs: { fr: "widget" } },
        "fr",
      ),
    ).toEqual(["widget"]);
  });

  it("lists only the canonical slug when there is no translation", () => {
    expect(slugsForLocale(NO_FRENCH, "fr")).toEqual(["usb-c-hub"]);
  });
});
