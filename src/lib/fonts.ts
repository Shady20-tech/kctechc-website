import { Inter, Sora } from "next/font/google";

/**
 * Type system.
 *
 * `next/font` self-hosts both faces at build time, so there is no render-blocking
 * request to a third-party font host and no layout shift from a late swap. The
 * CSS variables are consumed by the design tokens in `globals.css`, which keep a
 * system-font fallback so the site stays legible if a face fails to load.
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

export const fontClassNames = `${bodyFont.variable} ${headingFont.variable}`;
