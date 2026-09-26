"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal / drawer.
 *
 * One component covers both shapes: `placement="center"` is a dialog, and
 * `placement="side"` is the mobile navigation drawer. Behaviour that matters for
 * accessibility is implemented here rather than left to the caller:
 *
 * - Escape closes.
 * - Focus moves into the panel on open and returns to the trigger on close.
 * - Tab is trapped inside the panel while it is open.
 * - Background scroll is locked.
 *
 * Rendering is driven by the parent's `open` state, so the panel is absent from
 * the DOM (not merely hidden) when closed.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  placement = "center",
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  placement?: "center" | "side";
  closeLabel: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const isSide = placement === "side";

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-navy-950/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={
          isSide
            ? "absolute right-0 top-0 h-full w-[min(20rem,90vw)] overflow-y-auto bg-surface p-5 shadow-overlay"
            : "absolute left-1/2 top-1/2 w-[min(32rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-surface p-6 shadow-overlay"
        }
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-card p-1.5 text-muted transition-soft hover:bg-navy-50 hover:text-navy-900"
          >
            <X aria-hidden="true" className="h-5 w-5" />
            <span className="visually-hidden">{closeLabel}</span>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
