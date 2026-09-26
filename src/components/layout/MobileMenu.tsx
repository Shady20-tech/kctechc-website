"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/locales";

export type MobileNavItem = { href: string; label: string };

/**
 * Mobile navigation drawer.
 *
 * Reuses `Modal` in `placement="side"`, so focus trapping, Escape handling and
 * focus restoration are shared with the dialog rather than reimplemented.
 *
 * Departments appear as ordinary entries in `items` — the same links the desktop
 * nav uses — rather than a second, differently-grouped list, so the two menus
 * cannot drift apart.
 */
export function MobileMenu({
  locale,
  items,
  signInHref,
  labels,
}: {
  locale: Locale;
  items: readonly MobileNavItem[];
  signInHref: string;
  labels: {
    open: string;
    close: string;
    title: string;
    language: string;
    signIn: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-card border border-white/20 text-white transition-soft hover:bg-white/10 lg:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={labels.title}
        placement="side"
        closeLabel={labels.close}
      >
        <nav aria-label={labels.title}>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-card px-3 py-2.5 text-sm font-medium text-ink-900 transition-soft hover:bg-surface-alt"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="mono-label mt-7 px-3 text-muted">
            {labels.language}
          </h3>
          <ul className="mt-2 flex gap-2 px-3">
            {LOCALES.map((candidate) => (
              <li key={candidate}>
                <Link
                  href={`/${candidate}`}
                  hrefLang={candidate}
                  onClick={() => setOpen(false)}
                  aria-current={candidate === locale ? "true" : undefined}
                  className={
                    candidate === locale
                      ? "inline-block rounded-card border border-ink-900 px-3 py-1.5 text-sm font-semibold text-ink-900"
                      : "inline-block rounded-card border border-border px-3 py-1.5 text-sm text-muted transition-soft hover:border-ink-300 hover:text-ink-900"
                  }
                >
                  {LOCALE_LABELS[candidate]}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-7 px-3">
            <ButtonLink
              href={signInHref}
              variant="primary"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              {labels.signIn}
            </ButtonLink>
          </div>
        </nav>
      </Modal>
    </>
  );
}
