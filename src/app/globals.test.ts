import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cascade contract for the global stylesheet.
 *
 * This guards a bug that is invisible in jsdom and easy to reintroduce: rules
 * written at the top level of `globals.css` are *unlayered*, and an unlayered
 * rule beats every layered one regardless of specificity. Tailwind emits its
 * preflight and utilities inside `@layer`, so a bare `h1 { color: … }` in this
 * file silently overrode every `text-*` utility a component applied to a
 * heading. Headings on the dark hero bands rendered ink-on-ink as a result, and
 * the `focus-visible:outline-*` utilities on form fields were dead for the same
 * reason — both live regressions at the time this was written.
 *
 * A stylesheet test is the only automated check that catches this: the markup is
 * correct, the utility class is present in the DOM, and the computed colour is
 * wrong only once the cascade is applied.
 *
 * Comments are stripped before parsing: a rule preceded by a comment would
 * otherwise arrive with the comment text in its selector buffer, and the `^`
 * anchors below would miss it — which is exactly how the original `h1` rule was
 * written.
 */
export const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");

/** Top-level rules, i.e. those not nested inside any `@layer` block. */
export function topLevelSelectors(source: string): string[] {
  // Comments go first: a rule preceded by one would otherwise arrive here with
  // the comment text in its selector buffer, and the `^` anchor used by the
  // caller would miss it — which is exactly how the original `h1` rule was
  // written, and how a regression would be written again.
  const sheet = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];
  let depth = 0;
  let buffer = "";


  for (const char of sheet) {
    if (char === "{") {
      const header = buffer.trim();
      if (depth === 0 && header && !header.startsWith("@")) {
        selectors.push(header);
      }
      depth += 1;
      buffer = "";
    } else if (char === "}") {
      depth -= 1;
      buffer = "";
    } else if (depth === 0) {
      buffer += char;
    }
  }
  return selectors;
}

describe("globals.css cascade", () => {
  it("keeps element defaults inside @layer base", () => {
    const topLevel = topLevelSelectors(css);

    // A bare `h1`, `a`, `button`, `input`, … at the top level is the failure
    // mode described above. `html`/`body` are included because they carry the
    // same hazard for any utility that sets a background or colour.
    for (const selector of topLevel) {
      expect(
        selector,
        `"${selector}" is unlayered; wrap it in @layer base so utilities can win`,
      ).not.toMatch(/^(html|body|h[1-6]|p|a|button|input|select|textarea)\b/);
    }
  });

  it("declares the base layer it depends on", () => {
    expect(css).toMatch(/@layer\s+base\s*\{/);
  });

  it("keeps the heading default inside the base layer", () => {
    const baseStart = css.search(/@layer\s+base\s*\{/);
    expect(baseStart).toBeGreaterThan(-1);
    expect(css.slice(baseStart)).toMatch(/h1,[\s\S]*?color:\s*var\(--color-ink-900\)/);
  });

  it("defines the electric accent used by the hero headings", () => {
    // The headings reference `text-electric-300`; the theme must define it or
    // the utility compiles to an undefined custom property and the text inherits
    // instead of taking the accent.
    expect(css).toMatch(/--color-electric-300:\s*#[0-9a-f]{6}/i);
  });
});

/**
 * Product showcase animation.
 *
 * The showcase's whole safety argument is that the motion is a CSS enhancement
 * over server-rendered markup, and that a reduced-motion visitor gets a readable
 * fallback rather than a strip frozen at the end of its travel. Those are
 * stylesheet facts, not component facts, so they are pinned here.
 */
describe("product showcase motion", () => {
  // Everything from the reduced-motion block onward, so the two fallback rules
  // can be asserted without repeating the search.
  const reducedMotionBlock = css.slice(
    css.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/),
  );

  it("drifts the marquee track by exactly one set width and repeats", () => {
    expect(css).toMatch(
      /@keyframes\s+product-drift\s*\{[\s\S]*?translateX\(-50%\)/,
    );
  });

  it("pauses the drift on hover and keyboard focus", () => {
    expect(css).toMatch(
      /\.product-marquee:hover\s+\.product-marquee-track,[\s\S]*?\.product-marquee:focus-within\s+\.product-marquee-track\s*\{[\s\S]*?animation-play-state:\s*paused/,
    );
  });

  it("replaces the marquee with a scroll rather than a frozen strip under reduced motion", () => {
    expect(reducedMotionBlock).toMatch(
      /\.product-marquee-track\s*\{[\s\S]*?animation:\s*none/,
    );
    expect(reducedMotionBlock).toMatch(
      /\.product-marquee-track\s*\{[\s\S]*?transform:\s*none/,
    );
  });

  it("removes the accent pulse under reduced motion", () => {
    expect(reducedMotionBlock).toMatch(
      /\.product-grid\s+\.product-tile-media::after\s*\{[\s\S]*?animation:\s*none/,
    );
  });

  it("keeps the pulse scoped to the grid variant", () => {
    // The homepage marquee renders twelve tiles; an unscoped pulse would run
    // twelve infinite animations at once.
    expect(css).toMatch(/\.product-grid\s+\.product-tile-media::after/);
    expect(css).not.toMatch(/(^|\n)\.product-tile-media::after/);
  });

  it("selects the stagger delay per breakpoint and only for staggered items", () => {
    // The grid is one, two or three columns, so the delay differs by viewport.
    // The base value must apply to the class alone, and the two media queries
    // must override it — a missing override would leave the lg delay wrong.
    expect(css).toMatch(
      /\.reveal-stagger\s*\{\s*--reveal-delay:\s*var\(--reveal-delay-base\)/,
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*640px\)\s*\{\s*\.reveal-stagger\s*\{\s*--reveal-delay:\s*var\(--reveal-delay-sm\)/,
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1024px\)\s*\{\s*\.reveal-stagger\s*\{\s*--reveal-delay:\s*var\(--reveal-delay-lg\)/,
    );
  });
});

describe("topLevelSelectors", () => {
  // The parser is the whole test's basis, so its behaviour is pinned directly
  // rather than trusted. The first case is the exact shape of the bug: a bare
  // `h1` rule sitting behind a section comment at the top level of the file.
  it("detects a bare rule preceded by a comment", () => {
    const sheet =
      "/* a section comment */\nh1,\nh2 {\n  color: black;\n}\n";
    expect(topLevelSelectors(sheet)).toEqual(["h1,\nh2"]);
  });

  it("does not report rules nested in a layer", () => {
    const sheet = "@layer base {\n  h1 { color: black; }\n}\n";
    expect(topLevelSelectors(sheet)).toEqual([]);
  });

  it("reports a rule that follows a closed layer", () => {
    const sheet = "@layer base {\n  p { color: black; }\n}\nh1 { color: black; }\n";
    expect(topLevelSelectors(sheet)).toEqual(["h1"]);
  });
});
