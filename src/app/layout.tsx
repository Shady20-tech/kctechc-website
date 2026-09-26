import type { Metadata, Viewport } from "next";
import { fontClassNames } from "@/lib/fonts";
import { BRAND_COLORS } from "@/lib/config/site";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE_TEMPLATE } from "@/lib/seo/metadata";
import "./globals.css";

/**
 * Application root layout.
 *
 * The only layout that renders `<html>`/`<body>`. Route groups below it own their
 * own chrome (public header/footer, admin shell) but not the document, which is
 * what allows `not-found.tsx` and `error.tsx` to render inside the real layout
 * instead of falling back to a bare document.
 *
 * Fonts are loaded here via `next/font`, which self-hosts them at build time.
 */
export const metadata: Metadata = {
  title: {
    default: DEFAULT_TITLE_TEMPLATE.replace("%s | ", ""),
    template: DEFAULT_TITLE_TEMPLATE,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: "KC Technology Corporation",
};

export const viewport: Viewport = {
  // Matches the ink header band and `BRAND_COLORS.ink`, so mobile browser chrome
  // blends with the site rather than showing a stray navy bar.
  themeColor: BRAND_COLORS.ink,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontClassNames}>
      <body>{children}</body>
    </html>
  );
}
