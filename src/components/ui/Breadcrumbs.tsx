import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type BreadcrumbItem = {
  name: string;
  /** Absolute-from-root path including the locale, e.g. `/en/about`. */
  href: string;
};

/**
 * Breadcrumb navigation.
 *
 * The final crumb is plain text with `aria-current="page"` rather than a link to
 * the current URL, and the separator chevrons are `aria-hidden` so the trail is
 * announced as "Home, About" instead of including decorative glyphs.
 *
 * The matching BreadcrumbList JSON-LD is emitted by the page from the same item
 * array, so visible markup and structured data cannot disagree.
 */
export function Breadcrumbs({
  items,
  ariaLabel,
  className,
}: {
  items: readonly BreadcrumbItem[];
  ariaLabel: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-2">
              {isLast ? (
                <span aria-current="page" className="font-medium text-navy-900">
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-muted transition-soft hover:text-navy-900 hover:underline"
                >
                  {item.name}
                </Link>
              )}
              {!isLast ? (
                <ChevronRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-border-strong"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
