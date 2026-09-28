"use client";

import { ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { DepartmentIcon } from "@/components/ui/DepartmentIcon";
import { Modal } from "@/components/ui/Modal";
import type { NavEntry } from "@/lib/config/navigation";
import type { DepartmentSlug } from "@/lib/config/site";
import { isDepartmentSlug } from "@/lib/config/site";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/locales";
import { buildLocaleSwitchHref } from "@/lib/i18n/routing";

/**
 * Mobile navigation drawer.
 *
 * Reuses `Modal` in `placement="side" tone="ink"`, so focus trapping, Escape
 * handling and focus restoration are shared with the dialog rather than
 * reimplemented — and the drawer is the same ink surface as the header it opens
 * from, so it reads as the header unfolding rather than a white sheet appearing
 * over a dark site.
 *
 * Departments are rendered as a labelled group rather than a nested dropdown,
 * and each carries its icon. On a small screen vertical space is free, so a
 * second tap buys nothing; the icon is what makes three long department names
 * scannable at a glance. The icons are decorative (`aria-hidden` inside
 * `DepartmentIcon`), because each sits beside the department's visible name.
 *
 * Three deliberate differences from the desktop bar:
 *
 * - The drawer lists every top-level entry plus the sign-in action, while the
 *   desktop bar only appears from `xl`. The trigger has to be visible below
 *   `xl`, which is the whole point of the drawer.
 * - Language links go through `buildLocaleSwitchHref`, so switching language
 *   keeps the visitor on the page they were reading instead of dropping them on
 *   the home page. `useSearchParams` is avoided for the same reason as in the
 *   header switcher: it would force every page into a client render.
 * - The sign-in action is pinned to the bottom of the panel, so the primary
 *   action stays put however long the nav list grows.
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
    /** Trigger text. Short by design: it sits beside the logo in a 64px bar. */
    menuLabel: string;
    close: string;
    title: string;
    language: string;
    signIn: string;
    brand: string;
    brandSubtitle: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  return (
    <>
      {/* No `aria-label`: the visible word "Menu" is the accessible name, which
          keeps voice control and screen-reader output matching what is on
          screen. An `aria-label` here would override the visible text. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-card border border-white/20 px-3 text-sm font-medium text-white transition-soft hover:bg-white/10 xl:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
        {labels.menuLabel}
      </button>

      <Modal
        open={open}
        onClose={close}
        title={labels.title}
        placement="side"
        tone="ink"
        closeLabel={labels.close}
        heading={
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-display text-base font-bold leading-tight tracking-tight text-white">
              {labels.brand}
            </span>
            <span className="mono-label truncate leading-tight text-white/60">
              {labels.brandSubtitle}
            </span>
          </div>
        }
      >
        {/* The column takes the remaining height so the language switcher and
            the CTA can be pinned with `mt-auto` when the list is short, and
            still scroll with it when it is long. */}
        <nav aria-label={labels.title} className="flex min-h-0 flex-1 flex-col">
          <ul className="flex-1">
            {entries.map((entry) => {
              if (entry.kind === "link") {
                return (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      onClick={close}
                      className="flex min-h-12 items-center rounded-card px-3 text-base font-medium text-white/85 transition-soft hover:bg-white/10 hover:text-white"
                    >
                      {entry.label}
                    </Link>
                  </li>
                );
              }

              return (
                <li
                  key={entry.label}
                  className="mt-3 border-t border-white/10 pt-3"
                >
                  <h3 className="mono-label px-3 text-white/45">
                    {entry.label}
                  </h3>
                  <ul className="mt-1">
                    {entry.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={close}
                          className="flex min-h-12 items-center gap-3 rounded-card px-3 text-base font-medium text-white/85 transition-soft hover:bg-white/10 hover:text-white"
                        >
                          <span
                            aria-hidden="true"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-white/5 text-dept-accent"
                          >
                            <DepartmentIcon
                              slug={slugFromHref(item.href)}
                              className="h-4 w-4"
                            />
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-white/35"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto pt-5">
            <h3 className="mono-label px-3 text-white/45">{labels.language}</h3>
            <ul className="mt-2 flex gap-2 px-3">
              {LOCALES.map((candidate) => {
                const isCurrent = candidate === locale;
                return (
                  <li key={candidate} className="flex-1">
                    <Link
                      href={buildLocaleSwitchHref(pathname, "", candidate)}
                      hrefLang={candidate}
                      onClick={close}
                      aria-current={isCurrent ? "true" : undefined}
                      className={
                        isCurrent
                          ? "flex min-h-11 items-center justify-center rounded-card border border-electric-300 px-3 text-sm font-semibold text-electric-300"
                          : "flex min-h-11 items-center justify-center rounded-card border border-white/15 px-3 text-sm text-white/70 transition-soft hover:border-white/35 hover:text-white"
                      }
                    >
                      {LOCALE_LABELS[candidate]}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4">
              <ButtonLink
                href={signInHref}
                variant="accentOnInk"
                size="lg"
                className="w-full"
                onClick={close}
              >
                {labels.signIn}
              </ButtonLink>
            </div>
          </div>
        </nav>
      </Modal>
    </>
  );
}

/**
 * Department icon lookup by href.
 *
 * The nav model carries only an href and a label, so the slug is recovered from
 * the last path segment. A department menu item is always `/<locale>/<slug>`, so
 * this is exact rather than a guess; anything unexpected falls back to a real
 * department slug rather than throwing inside a render.
 */
function slugFromHref(href: string): DepartmentSlug {
  const segment = href.split("/").filter(Boolean).pop() ?? "";
  return isDepartmentSlug(segment) ? segment : "real-estate";
}
