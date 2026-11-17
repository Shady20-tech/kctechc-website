"use client";

import { ChevronDown } from "lucide-react";

import type { MarketplaceFilterSectionProps } from "./types";

/**
 * A collapsible filter group.
 *
 * A native `<details>` rather than a JavaScript accordion: it collapses without
 * hydration, its open/closed state is real markup a crawler and a no-JavaScript
 * visitor both get, and the summary is focusable and announced as a disclosure
 * for free. The section is `open` by default — a filter a visitor has to discover
 * by expanding six sections is a filter they will not use.
 *
 * The chevron is decorative and rotates from the `group-open` variant, so the
 * state is carried by `aria-expanded` on the summary rather than by the icon.
 */
export function MarketplaceFilterSection({
  title,
  children,
  defaultOpen = true,
  count,
}: MarketplaceFilterSectionProps) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-border last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3.5 text-sm font-semibold text-ink-900 transition-soft hover:text-dept-accent">
        <span className="flex items-center gap-2">
          {title}
          {count !== undefined && count > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-dept-accent px-1.5 text-[11px] font-semibold text-white">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted transition-soft group-open:rotate-180"
        />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}
