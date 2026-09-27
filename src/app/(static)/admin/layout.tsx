import type { Metadata } from "next";

/**
 * Layout for the internal admin area.
 *
 * `noindex` is declared here once so every admin route inherits it; the admin
 * surface must never appear in search results.
 *
 * This layout deliberately renders no chrome. The console shell — sidebar, top
 * bar, account menu — lives one level down in `(console)/layout.tsx`, so that the
 * sign-in and access-denied pages can share the `noindex` rule without rendering
 * navigation to a visitor who is not signed in.
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
