import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Skip link. Must be the first focusable element in the document so a keyboard
 * user can bypass the header navigation on every page.
 */
export function SkipLink({
  children,
  targetId = "main",
}: {
  children: ReactNode;
  targetId?: string;
}) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      {children}
    </a>
  );
}

export type NavItem = {
  href: string;
  label: string;
  /** Marks the item as the current page for assistive technology. */
  isCurrent?: boolean;
};

export function SiteHeaderNav({
  items,
  ariaLabel,
  currentLabel,
}: {
  items: readonly NavItem[];
  ariaLabel: string;
  currentLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel}>
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.isCurrent ? "page" : undefined}
              className="text-sm font-medium text-navy-900 hover:text-gold-700"
            >
              {item.label}
              {item.isCurrent ? (
                <span className="visually-hidden"> ({currentLabel})</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
