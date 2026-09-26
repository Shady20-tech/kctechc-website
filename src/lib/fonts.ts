import { Inter, JetBrains_Mono, Sora } from "next/font/google";

/**
 * Type system.
 *
 * `next/font` self-hosts all faces at build time, so there is no render-blocking
 * request to a third-party font host and no layout shift from a late swap. The
 * CSS variables are consumed by the design tokens in `globals.css`, which keep a
 * system-font fallback so the site stays legible if a face fails to load.
 *
 * Three roles: Sora for display headings, Inter for body copy, and JetBrains
 * Mono for the technical annotations (eyebrows, spec labels, reference numbers)
 * that carry the engineering character of the brand.
 */
export const bodyFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export const headingFont = Sora({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700"],
  variable: "--font-heading",
});

export const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-mono-code",
});

export const fontClassNames = `${bodyFont.variable} ${headingFont.variable} ${monoFont.variable}`;
