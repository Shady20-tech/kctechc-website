"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { NavEntry } from "@/lib/config/navigation";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/locales";

/**
 * Mobile navigation drawer.
 *
 * Reuses `Modal` in `placement="side"`, so focus trapping, Escape handling and
 * focus restoration are shared with the dialog rather than reimplemented.
 *
 * Departments are rendered as a labelled group rather than as a nested dropdown.
 * A dropdown inside a drawer adds a second tap for no benefit on a small screen,
 * where vertical space is free; grouping keeps the top-level items in the same
 * order as the desktop bar while making the three departments plainly visible.
 */
export function MobileMenu({
  locale,
  entries,
  signInHref,
  labels,
}: {
  locale: Locale;
  entries: readonly NavEntry[];
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
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-card border border-white/20 text-white transition-soft hover:bg-white/10 xl:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <Modal
        open={open}
        onClose={close}
        title={labels.title}
        placement="side"
        closeLabel={labels.close}
      >
        <nav aria-label={labels.title}>
          <ul className="space-y-1">
            {entries.map((entry) => {
              if (entry.kind === "link") {
                return (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      onClick={close}
                      className="block rounded-card px-3 py-2.5 text-sm font-medium text-ink-900 transition-soft hover:bg-surface-alt"
                    >
                      {entry.label}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={entry.label} className="pt-2">
                  <h3 className="mono-label px-3 text-muted">{entry.label}</h3>
                  <ul className="mt-1">
                    {entry.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={close}
                          className="block rounded-card px-3 py-2.5 pl-5 text-sm text-ink-900 transition-soft hover:bg-surface-alt"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
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
                  onClick={close}
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
              onClick={close}
            >
              {labels.signIn}
            </ButtonLink>
          </div>
        </nav>
      </Modal>
    </>
  );
}
