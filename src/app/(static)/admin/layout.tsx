import type { Metadata } from "next";
import "../../globals.css";

/**
 * Root layout for internal areas.
 *
 * `noindex` is declared here once so every admin route inherits it; the admin
 * surface must never appear in search results.
 */
export const metadata: Metadata = {
  title: "Admin | KC Technology Corporation",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main id="main" className="container-page py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
