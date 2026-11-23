import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The mobile hero scrim is a legibility *and* visibility control.
 *
 * Every hero on the site — the corporate pages, the three departments and
 * real-estate — renders its backdrop through `HeroMedia`, which layers
 * `.hero-scrim` over the photo. Below 1024px the copy runs edge to edge, so the
 * scrim is a flat vertical stack rather than the desktop's left-to-right taper.
 *
 * At 0.88 the photo transmitted only 12%, and every hero read as a near-black
 * band on a phone: the image was there but effectively invisible. The flat
 * alpha is now 0.78, which transmits 22% and still holds WCAG AA against a
 * pure-white photo — the worst case a hero can carry. The weakest pair is the
 * `ink-300` meta label at 4.83:1.
 *
 * These assertions pin both halves of that trade-off: light enough that the
 * photo is visible, dark enough that the smallest type still passes. A future
 * "make the hero pop" edit that darkens the scrim back toward 0.88, or lightens
 * it past the 0.78 floor, fails here instead of shipping.
 */
const CSS = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

/** The `@media (max-width: 1023px)` block that redefines `.hero-scrim`. */
function mobileScrimBlock(): string {
  const media = /@media \(max-width: 1023px\) \{\s*\.hero-scrim \{([\s\S]*?)\n  \}/.exec(
    CSS,
  );
  expect(media, "the mobile .hero-scrim override is missing").toBeTruthy();
  const body = media?.[1];
  if (body === undefined) throw new Error("mobile .hero-scrim override is empty");
  return body;
}

/** Every `rgb(6 9 11 / a)` alpha in a CSS fragment. */
function scrimAlphas(block: string): number[] {
  return [...block.matchAll(/rgb\(6 9 11 \/ ([\d.]+)\)/g)].map((m) =>
    Number(m[1]),
  );
}

/** WCAG relative luminance for an sRGB channel triple. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  );
}

function contrast(foreground: [number, number, number], background: [number, number, number]): number {
  const [a, b] = [luminance(foreground), luminance(background)].sort(
    (x, y) => y - x,
  ) as [number, number];
  return (a + 0.05) / (b + 0.05);
}

/** The scrim composited over a pure-white photo: the lightest result possible. */
function overWhite(alpha: number): [number, number, number] {
  return [6, 9, 11].map((c) => Math.round(255 * (1 - alpha) + c * alpha)) as [
    number,
    number,
    number,
  ];
}

const HERO_TEXT = {
  heading: [0x62, 0xe2, 0xff] as [number, number, number],
  body: [0xcc, 0xd4, 0xda] as [number, number, number],
  eyebrow: [0x4e, 0xd9, 0xd4] as [number, number, number],
  metaLabel: [0xa5, 0xb1, 0xba] as [number, number, number],
};

describe("mobile hero scrim", () => {
  it("keeps the photo visibly present rather than a near-black band", () => {
    for (const alpha of scrimAlphas(mobileScrimBlock())) {
      // 0.88 shipped once and left 12% transmission, which is why the heroes
      // looked blank on a phone.
      expect(alpha, "scrim is too opaque; the photo disappears").toBeLessThanOrEqual(
        0.84,
      );
      expect(
        alpha,
        "scrim is too transparent to protect the copy",
      ).toBeGreaterThanOrEqual(0.7);
    }
  });

  it("holds WCAG AA for every hero text tone over the lightest possible photo", () => {
    const alphas = scrimAlphas(mobileScrimBlock());
    expect(alphas.length).toBeGreaterThan(0);
    // The weakest stop governs: a gradient is only as legible as its lightest
    // point.
    const lightest = Math.min(...alphas);
    const background = overWhite(lightest);
    for (const [name, colour] of Object.entries(HERO_TEXT)) {
      const ratio = contrast(colour, background);
      expect(ratio, `${name} on the lightest scrim stop`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("uses a vertical stack on mobile, not the desktop side taper", () => {
    // A left-to-right gradient leaves the ends of wrapped lines over open
    // photo once the copy runs edge to edge.
    expect(mobileScrimBlock()).toMatch(/to bottom/);
    expect(mobileScrimBlock()).not.toMatch(/to right/);
  });
});
