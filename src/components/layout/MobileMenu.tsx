"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DEPARTMENTS, type DepartmentSlug } from "@/lib/config/site";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/locales";

export type MobileNavItem = { href: string; label: string };

/**
 * Mobile navigation drawer.
 *
 * Reuses `Modal` in `placement="side"`, so focus trapping, Escape handling and
 * focus restoration are shared with the dialog rather than reimplemented.
 *
 * Language links are plain anchors to the other locale's version of the current
 * page, which keeps the drawer usable without JavaScript reading the router.
 */
export function MobileMenu({
  locale,
  items,
  departmentLabels,
  quoteHref,
  labels,
}: {
  locale: Locale;
  items: readonly MobileNavItem[];
  departmentLabels: Record<DepartmentSlug, string>;
  quoteHref: string;
  labels: {
    open: string;
    close: string;
    title: string;
    departments: string;
    language: string;
    getQuote: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-card border border-border-strong px-3 py-2 text-sm font-medium text-navy-900 transition-soft hover:border-navy-500 lg:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
        {labels.open}
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
                  className="block rounded-card px-3 py-2.5 text-sm font-medium text-navy-900 transition-soft hover:bg-surface-alt"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {labels.departments}
          </h3>
          <ul className="mt-1 space-y-1">
            {DEPARTMENTS.map((department) => (
              <li key={department.slug}>
                <Link
                  href={`/${locale}/${department.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-card px-3 py-2.5 text-sm text-navy-900 transition-soft hover:bg-surface-alt"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: department.accent }}
                  />
                  {departmentLabels[department.slug]}
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {labels.language}
          </h3>
          <ul className="mt-1 flex gap-2 px-3">
            {LOCALES.map((candidate) => (
              <li key={candidate}>
                <Link
                  href={`/${candidate}`}
                  hrefLang={candidate}
                  onClick={() => setOpen(false)}
                  aria-current={candidate === locale ? "true" : undefined}
                  className={
                    candidate === locale
                      ? "inline-block rounded-card px-3 py-1.5 text-sm font-semibold text-navy-900 underline underline-offset-4"
                      : "inline-block rounded-card px-3 py-1.5 text-sm text-muted hover:text-navy-900"
                  }
                >
                  {LOCALE_LABELS[candidate]}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 px-3">
            <ButtonLink
              href={quoteHref}
              variant="accent"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              {labels.getQuote}
            </ButtonLink>
          </div>
        </nav>
      </Modal>
    </>
  );
}
