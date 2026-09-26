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
  tone = "dark",
}: {
  items: readonly BreadcrumbItem[];
  ariaLabel: string;
  className?: string;
  /** `light` is for the dark ink bands; `dark` for light surfaces. */
  tone?: "dark" | "light";
}) {
  if (items.length === 0) return null;

  const currentClass =
    tone === "light"
      ? "font-medium text-white"
      : "font-medium text-ink-900";
  const linkClass =
    tone === "light"
      ? "text-ink-300 transition-soft hover:text-white hover:underline"
      : "text-muted transition-soft hover:text-ink-900 hover:underline";
  const separatorClass =
    tone === "light" ? "text-white/30" : "text-border-strong";

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-2">
              {isLast ? (
                <span aria-current="page" className={currentClass}>
                  {item.name}
                </span>
              ) : (
                <Link href={item.href} className={linkClass}>
                  {item.name}
                </Link>
              )}
              {!isLast ? (
                <ChevronRight
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 ${separatorClass}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
