import Link from "next/link";

import type { MarketplaceCategoryItem } from "./types";

/**
 * Quick category navigation.
 *
 * Rendered as links, not buttons: each category is a real URL built by the
 * department from its own filter model, so it is shareable, crawlable as
 * `noindex, follow`, and works without JavaScript. The count beside an entry is
 * a real count from the same predicate the search uses, so a shortcut reading
 * "12" leads to a result set of 12; an entry with no count shows none rather than
 * a zero, so the navigation never implies inventory that is not there.
 *
 * A Server Component — nothing here is interactive beyond navigation.
 */
export function MarketplaceCategoryNavigation({
  items,
  ariaLabel,
  variant = "chips",
}: {
  items: readonly MarketplaceCategoryItem[];
  ariaLabel: string;
  /** `chips` is the landing-page row; `list` is the sidebar's vertical stack. */
  variant?: "chips" | "list";
}) {
  if (items.length === 0) return null;

  if (variant === "list") {
    return (
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.value}>
            <Link
              href={item.href}
              aria-current={item.active ? "true" : undefined}
              className={`flex items-center justify-between gap-2 rounded-control px-2.5 py-2 text-sm transition-soft ${
                item.active
                  ? "bg-surface-alt font-semibold text-dept-accent"
                  : "text-body hover:bg-surface-alt"
              }`}
            >
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 ? (
                <span className="text-xs text-muted">{item.count}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.value}>
          <Link
            href={item.href}
            aria-current={item.active ? "true" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm transition-soft ${
              item.active
                ? "border-dept-accent bg-surface-alt font-semibold text-dept-accent"
                : "border-border bg-surface-alt text-body hover:border-dept-accent"
            }`}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 ? (
              <span className="text-xs text-muted">{item.count}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
