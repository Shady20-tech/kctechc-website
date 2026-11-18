import Link from "next/link";

import type { MarketplaceActiveFilterChip } from "./types";

/**
 * The active filters, as removable chips.
 *
 * The point of this component is that a filtered result set has to say *why* it
 * is what it is. Without it, a visitor who lands on a shared link with four
 * filters applied sees a short list and no explanation, and the only way to
 * discover the cause is to open the filter panel and read every control.
 *
 * Each chip is a link to the same view with that one filter removed. The href and
 * the label are computed by the calling department from its own typed filter
 * model, so this component never learns what a filter *is* — it only renders what
 * it is told, and a store chip can never be built from a listing field.
 *
 * A chip is a link, not a button: the target is a real URL, so it is shareable,
 * crawlable as `noindex, nofollow`, and works without JavaScript.
 *
 * A Server Component — the removal targets are plain URLs.
 */
export function MarketplaceActiveFilters({
  chips,
  clearHref,
  clearLabel,
  label,
  className,
}: {
  chips: readonly MarketplaceActiveFilterChip[];
  clearHref: string;
  clearLabel: string;
  /** The leading caption, e.g. "Active filters". */
  label: string;
  className?: string;
}) {
  if (chips.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <span className="mono-label text-muted">{label}</span>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-sm text-body transition-soft hover:border-dept-accent"
              // The label names the filter and its value, so a screen-reader
              // user hears "Remove filter Region: South West", not "Region".
              aria-label={chip.removeLabel}
            >
              <span>{chip.label}</span>
              <XMark />
            </Link>
          </li>
        ))}
      </ul>
      {/* Clear all drops every filter at once — including any the chip list
          cannot render. The department supplies the target, so a view flag or a
          department-scoped path is preserved by the caller that knows about it. */}
      <Link
        href={clearHref}
        className="text-sm font-medium text-dept-accent underline-offset-4 hover:underline"
      >
        {clearLabel}
      </Link>
    </div>
  );
}

/**
 * The removal glyph.
 *
 * Inlined rather than imported from the icon package so this Server Component
 * pulls no client icon runtime; it is decorative, so it is `aria-hidden` and the
 * link's accessible name comes from `removeLabel`.
 */
function XMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
