import type { Metadata } from "next";

/**
 * Layout for internal areas.
 *
 * `noindex` is declared here once so every admin route inherits it; the admin
 * surface must never appear in search results. The document element is owned by
 * the root layout.
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="container-page py-12">
      {children}
    </main>
  );
}
