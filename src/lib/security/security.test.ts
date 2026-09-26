import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { buildContentSecurityPolicy } from "@/lib/security/headers";
import {
  paginationSchema,
  safeRedirectPathSchema,
  slugSchema,
  uuidSchema,
} from "@/lib/validation/common";
import { signInSchema } from "@/lib/validation/auth";
import { STATIC_MESSAGES } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translator";

describe("checkRateLimit", () => {
  it("allows requests up to the limit and then blocks", () => {
    const key = `test-${Math.random()}`;
    const options = { limit: 3, windowSeconds: 60 };

    expect(checkRateLimit(key, options).allowed).toBe(true);
    expect(checkRateLimit(key, options).allowed).toBe(true);
    expect(checkRateLimit(key, options).allowed).toBe(true);

    const blocked = checkRateLimit(key, options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    const options = { limit: 1, windowSeconds: 60 };
    expect(checkRateLimit(a, options).allowed).toBe(true);
    expect(checkRateLimit(b, options).allowed).toBe(true);
    expect(checkRateLimit(a, options).allowed).toBe(false);
  });
});

describe("safeRedirectPathSchema", () => {
  it("accepts site-relative paths", () => {
    expect(safeRedirectPathSchema.safeParse("/admin").success).toBe(true);
    expect(safeRedirectPathSchema.safeParse("/en/real-estate?q=x").success).toBe(
      true,
    );
  });

  it("rejects absolute and protocol-relative URLs", () => {
    for (const value of [
      "https://evil.example.com",
      "//evil.example.com",
      "\\\\evil.example.com",
      "admin",
    ]) {
      expect(safeRedirectPathSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("slugSchema", () => {
  it("accepts lowercase hyphenated slugs", () => {
    expect(slugSchema.safeParse("digital-marketing").success).toBe(true);
  });

  it("rejects uppercase, spaces, and edge hyphens", () => {
    for (const value of ["Digital", "digital marketing", "-digital", "digital-"]) {
      expect(slugSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("uuidSchema", () => {
  it("accepts a valid uuid and rejects a malformed one", () => {
    expect(
      uuidSchema.safeParse("3f2504e0-4f89-11d3-9a0c-0305e82c3301").success,
    ).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("applies defaults and coerces query strings", () => {
    const result = paginationSchema.parse({});
    expect(result).toEqual({ page: 1, perPage: 24 });
    expect(paginationSchema.parse({ page: "3", perPage: "10" })).toEqual({
      page: 3,
      perPage: 10,
    });
  });

  it("rejects out-of-range values", () => {
    expect(paginationSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(paginationSchema.safeParse({ perPage: "500" }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("accepts valid credentials with an optional safe next path", () => {
    const result = signInSchema.safeParse({
      email: "owner@kctechc.example",
      password: "correct-horse-battery",
      next: "/admin",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a short password and an unsafe next path", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.co", password: "short" }).success,
    ).toBe(false);
    expect(
      signInSchema.safeParse({
        email: "a@b.co",
        password: "long-enough-password",
        next: "//evil.example.com",
      }).success,
    ).toBe(false);
  });
});

describe("buildContentSecurityPolicy", () => {
  it("includes Supabase and Tolgee in connect-src when configured", () => {
    const csp = buildContentSecurityPolicy({
      supabaseUrl: "https://project.supabase.co",
      tolgeeApiUrl: "https://app.tolgee.io",
      isDevelopment: false,
    });
    expect(csp).toContain("connect-src 'self' https://project.supabase.co https://app.tolgee.io");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("never allows unsafe-eval in production", () => {
    const csp = buildContentSecurityPolicy({
      supabaseUrl: null,
      tolgeeApiUrl: "https://app.tolgee.io",
      isDevelopment: false,
    });
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows unsafe-eval only in development", () => {
    const csp = buildContentSecurityPolicy({
      supabaseUrl: null,
      tolgeeApiUrl: "https://app.tolgee.io",
      isDevelopment: true,
    });
    expect(csp).toContain("unsafe-eval");
  });
});

describe("translator", () => {
  it("resolves keys for both locales", () => {
    expect(createTranslator("en").t("nav.home")).toBe("Home");
    expect(createTranslator("fr").t("nav.home")).toBe("Accueil");
  });

  it("interpolates tokens", () => {
    const message = createTranslator("en").t("footer.copyright", { year: 2026 });
    expect(message).toContain("2026");
  });

  it("falls back to English for a key missing in French", () => {
    const en = STATIC_MESSAGES.en;
    const t = createTranslator("fr").t;
    // A key present in English must never render as the raw key in French.
    expect(t("common.brand")).toBe(en.common.brand);
  });

  it("returns the key itself when it exists in neither locale", () => {
    expect(createTranslator("en").t("does.not.exist")).toBe("does.not.exist");
  });

  it("keeps both dictionaries structurally aligned", () => {
    const flatten = (value: unknown, prefix = ""): string[] => {
      if (typeof value === "string") return [prefix];
      if (typeof value !== "object" || value === null) return [];
      return Object.entries(value).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
      );
    };

    expect(flatten(STATIC_MESSAGES.fr).sort()).toEqual(
      flatten(STATIC_MESSAGES.en).sort(),
    );
  });
});
