import Link from "next/link";
import { STATIC_MESSAGES } from "@/lib/i18n/messages";

/**
 * Root not-found page.
 *
 * Rendered for paths outside any locale tree, so it is language-neutral and
 * offers both locale entry points rather than assuming a language. It sits inside
 * the root layout, so fonts and base styles are already applied.
 */
export default function NotFound() {
  const en = STATIC_MESSAGES.en;
  const fr = STATIC_MESSAGES.fr;

  return (
    <main id="main" className="container-page section">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">
        404
      </p>
      <h1 className="mt-3 text-3xl font-bold text-navy-900">
        {en.errors.notFoundTitle} / {fr.errors.notFoundTitle}
      </h1>
      <p className="mt-4 max-w-2xl text-base text-body">
        {en.errors.notFoundDescription} {fr.errors.notFoundDescription}
      </p>

      <ul className="mt-8 flex flex-wrap gap-3">
        <li>
          <Link
            href="/en"
            className="inline-block rounded-card bg-navy-900 px-5 py-3 text-sm font-semibold text-white transition-soft hover:bg-navy-700"
          >
            {en.actions.enterSite} (English)
          </Link>
        </li>
        <li>
          <Link
            href="/fr"
            className="inline-block rounded-card border border-navy-900 px-5 py-3 text-sm font-semibold text-navy-900 transition-soft hover:bg-navy-900 hover:text-white"
          >
            {fr.actions.enterSite} (Français)
          </Link>
        </li>
        <li>
          <Link
            href="/"
            className="inline-block rounded-card px-5 py-3 text-sm font-semibold text-navy-700 underline underline-offset-4"
          >
            {en.common.backToHome}
          </Link>
        </li>
      </ul>
    </main>
  );
}
