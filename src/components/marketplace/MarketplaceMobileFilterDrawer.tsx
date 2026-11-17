"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Modal } from "@/components/ui/Modal";
import type { MarketplaceDrawerLabels } from "./types";

/**
 * The mobile filter entry point.
 *
 * The desktop sidebar is `hidden` below `lg`, so a narrow viewport gets this
 * instead of a horizontally-overflowing panel. The trigger shows the number of
 * active filters, because "Filter" alone gives no indication that a short result
 * list is the visitor's own doing.
 *
 * The controls live inside a `Modal` with `placement="side"`, which already
 * handles focus trapping, Escape, scroll lock and focus return — the same
 * behaviour the site's navigation drawer uses, so the two feel identical. The
 * filter form itself is passed as children: it is the *same* form component the
 * desktop sidebar renders, so the two presentations cannot drift.
 *
 * Selections inside the drawer are committed by the form's Apply button (a real
 * GET submit) or by an immediate-navigate control, so closing the drawer without
 * applying leaves the URL — and therefore the results — untouched.
 */
export function MarketplaceMobileFilterDrawer({
  labels,
  activeCount,
  children,
  triggerClassName,
}: {
  labels: MarketplaceDrawerLabels;
  activeCount: number;
  /** The filter form, rendered inside the drawer panel. */
  children: ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-control border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink-900 transition-soft hover:border-dept-accent ${triggerClassName ?? "lg:hidden"}`}
      >
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
        {labels.open}
        {activeCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-dept-accent px-1.5 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={labels.title}
        placement="side"
        closeLabel={labels.close}
      >
        <div className="mt-2">{children}</div>
      </Modal>
    </>
  );
}
