import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_COLORS,
  DEPARTMENT_SLUGS,
  DEPARTMENT_THEME_TOKENS,
  departmentThemeCssVars,
  type DepartmentSlug,
} from "@/lib/config/site";

/**
 * Accessibility contract for the department micro-themes.
 *
 * The palettes exist so an older, low-vision audience can read the site, which
 * makes the contrast ratios a requirement rather than a preference. This test
 * asserts every text-on-canvas pair against WCAG AA (4.5:1 for body copy, 3:1 for
 * large text and UI boundaries) from the same token object the stylesheet is
 * generated from, and separately asserts that the stylesheet's
 * `html[data-theme=…]` block still carries those exact values — so a colour
 * changed in one place without the other fails here rather than shipping.
 *
 * It reads `globals.css` for the same reason `globals.test.ts` does: the cascade
 * is the ground truth, and a token that exists in TypeScript but never reaches
 * the document is invisible to every component test.
 */

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

const AA_TEXT = 4.5;
const AA_LARGE = 3;

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** WCAG 2.1 contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Parse the `html[data-theme="<slug>"]` block out of the stylesheet. */
function cssThemeBlock(slug: DepartmentSlug): Record<string, string> {
  const pattern = new RegExp(`html\\[data-theme="${slug}"\\]\\s*\\{([^}]*)\\}`);
  const match = css.match(pattern);
  if (!match?.[1]) throw new Error(`no data-theme block for "${slug}"`);
  const declarations: Record<string, string> = {};
  for (const line of match[1].split(";")) {
    const [name, value] = line.split(":");
    if (name && value) declarations[name.trim()] = value.trim().toLowerCase();
  }
  return declarations;
}

const BRAND_KEY: Record<DepartmentSlug, string> = {
  "digital-marketing": BRAND_COLORS.digitalMarketing,
  "electrical-services": BRAND_COLORS.electricalServices,
  "real-estate": BRAND_COLORS.realEstate,
};

describe("department theme palettes", () => {
  for (const slug of DEPARTMENT_SLUGS) {
    const theme = DEPARTMENT_THEME_TOKENS[slug];

    describe(slug, () => {
      it("keeps body copy above AA on the canvas and cards", () => {
        expect(contrastRatio(theme.body, theme.surface)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
        expect(contrastRatio(theme.body, theme.canvas)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      });

      it("keeps muted copy above AA on every band", () => {
        for (const band of [theme.surface, theme.canvas, theme.surfaceAlt]) {
          expect(contrastRatio(theme.muted, band)).toBeGreaterThanOrEqual(
            AA_TEXT,
          );
        }
      });

      it("keeps headings above AA on the canvas and cards", () => {
        for (const band of [theme.surface, theme.canvas, theme.surfaceAlt]) {
          expect(contrastRatio(theme.ink900, band)).toBeGreaterThanOrEqual(
            AA_TEXT,
          );
          expect(contrastRatio(theme.ink700, band)).toBeGreaterThanOrEqual(
            AA_TEXT,
          );
        }
      });

      it("keeps the accent legible as text and behind white", () => {
        expect(
          contrastRatio(theme.accent, theme.surface),
        ).toBeGreaterThanOrEqual(AA_TEXT);
        expect(
          contrastRatio(theme.accent, theme.canvas),
        ).toBeGreaterThanOrEqual(AA_TEXT);
        expect(contrastRatio("#ffffff", theme.accent)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      });

      it("keeps the card surface lighter than the page canvas", () => {
        // The canvas/card split is what stops a department page reading as a
        // flat sheet: the canvas carries the tint and the cards sit above it.
        // If the two ever converge the theme stops being visible.
        expect(relativeLuminance(theme.surface)).toBeGreaterThan(
          relativeLuminance(theme.canvas),
        );
      });

      it("keeps white chrome type above AA on the dark band", () => {
        // The header and footer are always dark, so this pair is what a theme
        // must not break. It is also the only place `text-white/…` runs.
        expect(contrastRatio("#ffffff", theme.ink950)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
        expect(contrastRatio("#ffffff", theme.ink800)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      });

      it("keeps the bright accent above AA on the dark band", () => {
        // Used by the footer column headings and the active language link, both
        // of which sit on the dark band.
        expect(
          contrastRatio(theme.accentBright, theme.ink950),
        ).toBeGreaterThanOrEqual(AA_TEXT);
      });

      it("keeps the canvas light so dark chrome text stays readable", () => {
        // A department canvas must stay lighter than its own dark band, which is
        // what lets `text-ink-900` and the white-on-ink bands coexist.
        for (const band of [theme.surface, theme.canvas]) {
          expect(contrastRatio(band, theme.ink950)).toBeGreaterThanOrEqual(
            AA_TEXT,
          );
        }
      });

      it("mirrors the brand accent colour", () => {
        expect(theme.accent.toLowerCase()).toBe(BRAND_KEY[slug].toLowerCase());
      });
    });
  }
});

describe("globals.css theme blocks", () => {
  it("declares a block for every department", () => {
    for (const slug of DEPARTMENT_SLUGS) {
      expect(() => cssThemeBlock(slug)).not.toThrow();
    }
  });

  it("carries the same values as the TypeScript tokens", () => {
    for (const slug of DEPARTMENT_SLUGS) {
      const declarations = cssThemeBlock(slug);
      const expected = departmentThemeCssVars(slug);
      for (const [name, value] of Object.entries(expected)) {
        expect(declarations[name], `${slug} ${name}`).toBe(value.toLowerCase());
      }
    }
  });

  it("re-derives the department accent from the theme accent", () => {
    for (const slug of DEPARTMENT_SLUGS) {
      const declarations = cssThemeBlock(slug);
      expect(declarations["--dept-accent"]).toBe("var(--color-accent)");
      expect(declarations["--dept-accent-bright"]).toBe(
        "var(--color-accent-bright)",
      );
    }
  });

  it("keeps the theme transition inside @layer base", () => {
    // An unlayered transition rule beats every layered one and would strip
    // `.transition-soft` and `[data-reveal]` of the transition they depend on.
    expect(css).toMatch(
      /@layer\s+base\s*\{[\s\S]*data-theme[\s\S]*transition:/,
    );
  });

  it("keeps the corporate accent at AA on the corporate ink", () => {
    expect(contrastRatio("#ffffff", BRAND_COLORS.teal)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
    expect(
      contrastRatio(BRAND_COLORS.tealBright, BRAND_COLORS.ink),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("keeps the focus ring above the 3:1 boundary on both surfaces", () => {
    expect(contrastRatio("#007d78", "#ffffff")).toBeGreaterThanOrEqual(
      AA_LARGE,
    );
    expect(contrastRatio("#4ed9d4", "#06090b")).toBeGreaterThanOrEqual(
      AA_LARGE,
    );
  });
});
