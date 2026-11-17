import type { ReactNode } from "react";

import type { MarketplaceEmptyStateProps } from "./types";

/**
 * The consistent empty state.
 *
 * Two different messages, deliberately distinct: "nothing is published yet" is a
 * statement about the catalogue, and "your filters matched nothing" is a
 * statement about the search. Showing the second for an empty catalogue would
 * blame the visitor for a filter they never set, and showing the first for a
 * filtered miss would tell them the inventory does not exist when it does.
 *
 * The caller supplies the heading, body and optional action already translated
 * and already linked, so this component renders one shape on every department
 * without knowing what the department sells.
 */
export function MarketplaceEmptyState({
  heading,
  body,
  action,
  className,
}: MarketplaceEmptyStateProps & { className?: string }): ReactNode {
  return (
    <div
      className={`max-w-2xl rounded-card border border-border bg-surface p-8 ${className ?? ""}`}
    >
      <h2 className="text-xl font-semibold text-ink-900">{heading}</h2>
      <p className="mt-3 text-base leading-relaxed text-body">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
