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
