"use client";

import type { ReactNode } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import type { MarketplaceFilterLabels } from "./types";

/**
 * The filter form shell.
 *
 * A plain GET form, so the filters ARE the query string: submitting navigates to
 * the filtered URL, a filtered view is shareable and cacheable, the back button
 * behaves, and everything works without JavaScript.
 *
 * This component owns only the form element and its actions; the *fields* are the
 * department's own, passed as children. That is the seam the brief requires — one
 * layout, three different sets of fields — and it is why a store filter and a
 * property filter cannot bleed into each other: they are different children of
 * the same shell.
 *
 * In its `drawer` variant the actions become a sticky footer with an Apply button
 * and a Close control, because a drawer is dismissed rather than navigated away
 * from, and the visitor needs an explicit way to commit a selection.
 */
export function MarketplaceFilterSidebar({
  action,
  labels,
  children,
  activeCount = 0,
  variant = "sidebar",
  onClose,
  className,
}: {
  /** The results path the GET form submits to. */
  action: string;
  labels: MarketplaceFilterLabels;
  children: ReactNode;
  activeCount?: number;
  variant?: "sidebar" | "drawer";
  onClose?: () => void;
  className?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className={`flex h-full flex-col ${className ?? ""}`}
    >
      <div className="flex-1">{children}</div>

      <div
        className={`mt-6 flex flex-wrap gap-3 ${
          variant === "drawer"
            ? "sticky bottom-0 -mx-5 border-t border-border bg-surface px-5 py-4"
            : ""
        }`}
      >
        <Button type="submit" variant="primary" className="flex-1">
          {labels.submit}
        </Button>
        <ButtonLink href={action} variant="secondary">
          {labels.clear}
        </ButtonLink>
        {variant === "drawer" && onClose ? (
          <Button type="button" variant="ghost" onClick={onClose}>
            {labels.close}
          </Button>
        ) : null}
        {activeCount > 0 && labels.activeCount ? (
          <p className="w-full text-xs text-muted">{labels.activeCount}</p>
        ) : null}
      </div>
    </form>
  );
}
