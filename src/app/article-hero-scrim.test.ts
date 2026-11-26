import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrast contract for the article-cover hero scrim.
 *
 * An article cover is an arbitrary editor upload, so unlike the curated hero
 * photography its brightness range is unbounded — it can be a pure-white product
 * shot. The hero copy sits on top of it, which means the scrim, not the image,
 * has to guarantee legibility.
 *
 * This computes the worst case rather than trusting the numbers in the CSS
 * comment: a pure-white cover, the decorative `.bg-glow` composited *on top* of
 * the scrim (it is a later sibling in the markup, which is the order that
 * actually renders), and the lightest text tone used on the band. The existing
 * `.hero-scrim` stops gave the byline 1.65:1 at 62% width — the copy column
 * extends to about 62% of the container — which is the defect this guards.
 */

const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");

function linearise(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: readonly number[]): number {
  return (
    0.2126 * linearise(r as number) +
    0.7152 * linearise(g as number) +
    0.0722 * linearise(b as number)
  );
}

function contrast(a: readonly number[], b: readonly number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over compositing of `fg` at `alpha` onto `bg`. */
function over(
  fg: readonly number[],
  alpha: number,
  bg: readonly number[],
): number[] {
  return fg.map(
    (channel, i) => channel * alpha + (bg[i] as number) * (1 - alpha),
  );
}

/** Extract the horizontal stops of a named scrim rule, in order. */
function scrimStops(selector: string): { offset: number; alpha: number }[] {
  const block = css.split(selector)[1];
  if (!block) throw new Error(`selector ${selector} not found`);
  const body = block.slice(0, block.indexOf("}"));
  const stops: { offset: number; alpha: number }[] = [];
  const pattern = /rgb\(6 9 11 \/ ([\d.]+)\)(?:\s+(\d+)%)?/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(body)) !== null) {
    stops.push({
      offset: match[2] ? Number(match[2]) / 100 : index === 0 ? 0 : 1,
      alpha: Number(match[1]),
    });
    index += 1;
  }
  return stops;
}

function alphaAt(
  stops: { offset: number; alpha: number }[],
  position: number,
): number {
  for (let i = 0; i < stops.length - 1; i += 1) {
    const from = stops[i] as { offset: number; alpha: number };
    const to = stops[i + 1] as { offset: number; alpha: number };
    if (position >= from.offset && position <= to.offset) {
      const span = to.offset - from.offset;
      const t = span === 0 ? 0 : (position - from.offset) / span;
      return from.alpha + (to.alpha - from.alpha) * t;
    }
  }
  return (stops[stops.length - 1] as { alpha: number }).alpha;
}

const WHITE_PHOTO = [255, 255, 255];
const INK_300 = [165, 177, 186];
const INK_950_BAND = [6, 9, 11];
const GLOW_TEAL = [0, 169, 163];
/** `.bg-glow` peak alpha, from the radial gradient in the stylesheet. */
const GLOW_ALPHA = 0.24;
/** The copy column is `max-w-3xl` inside `container-page`: about 62%. */
const COPY_COLUMN = 0.68;

describe("article-cover hero scrim", () => {
  const stops = scrimStops(".hero-scrim-article {");

  it("holds AA for the lightest copy tone across the whole copy column", () => {
    for (let position = 0; position <= COPY_COLUMN; position += 0.02) {
      const scrimmed = over(
        INK_950_BAND,
        alphaAt(stops, position),
        WHITE_PHOTO,
      );
      // The glow is a later sibling, so it composites over the scrim.
      const glow = Math.max(0, GLOW_ALPHA * (1 - position / COPY_COLUMN));
      const background = over(GLOW_TEAL, glow, scrimmed);
      expect(contrast(INK_300, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("is stronger than the shared hero scrim where the copy sits", () => {
    const shared = scrimStops(".hero-scrim {");
    // The defect: the shared stops fall to 0.72 by 40% and keep thinning, which
    // is too weak for an arbitrary upload at the end of the copy column.
    expect(alphaAt(stops, COPY_COLUMN)).toBeGreaterThan(
      alphaAt(shared, COPY_COLUMN),
    );
    expect(alphaAt(stops, COPY_COLUMN)).toBeGreaterThanOrEqual(0.8);
  });

  it("still lets the photograph read on the far edge", () => {
    expect(alphaAt(stops, 1)).toBeLessThanOrEqual(0.2);
  });
});
