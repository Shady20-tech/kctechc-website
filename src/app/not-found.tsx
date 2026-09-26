import Link from "next/link";

/**
 * Root not-found page.
 *
 * Served for paths outside any locale tree. It is language-neutral and offers
 * both locale entry points rather than assuming a language.
 */
export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <main
          id="main"
          style={{
            maxWidth: "42rem",
            margin: "0 auto",
            padding: "4rem 1rem",
            fontFamily: "system-ui, sans-serif",
            color: "#3C4858",
          }}
        >
          <h1 style={{ color: "#0B2545" }}>Page not found / Page introuvable</h1>
          <p>
            The page you requested may have moved or no longer exists. La page
            demandée a peut-être été déplacée ou n&apos;existe plus.
          </p>
          <ul>
            <li>
              <Link href="/en">Continue in English</Link>
            </li>
            <li>
              <Link href="/fr">Continuer en français</Link>
            </li>
          </ul>
        </main>
      </body>
    </html>
  );
}
