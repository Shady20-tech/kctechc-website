"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
 *
 * `tone="ink"` renders the dark variant used by the mobile drawer. The drawer is
 * the same surface family as the header it opens from, so it reads as the header
 * unfolding rather than as a white sheet appearing over a dark site.
 *
 * A side drawer is sized to leave the page visible beside it — that is the point
 * of a drawer over a full-screen sheet. The panel is a flat 300px (`18.75rem`),
 * with an `82vw` cap so a narrow phone does not end up with a drawer wider than
 * the screen. Both terms are needed: without the cap the panel is 92% of a
 * 360px viewport and reads as a full-screen takeover, which is the bug this
 * width was chosen to fix. The cap only binds below ~366px, so most phones get
 * the full 300px and the narrowest get a proportional 82%.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  placement = "center",
  closeLabel,
  tone = "light",
  heading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  placement?: "center" | "side";
  closeLabel: string;
  tone?: "light" | "ink";
  /**
   * Replaces the default text heading while keeping the close control and the
   * `aria-label`. The drawer supplies its own branding row here; the accessible
   * name still comes from `title`, so the two cannot disagree in the way a
   * separately-written `aria-label` would.
   */
  heading?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // The panel is portalled to `document.body`. It is rendered from inside the
  // sticky header, which carries `backdrop-blur`; a `backdrop-filter` on an
  // ancestor makes that element a containing block for `position: fixed`
  // descendants, so the panel's `inset-0` resolved against the 64px header
  // instead of the viewport and the drawer collapsed to the width of the header
  // row. Portalling escapes that ancestor rather than requiring the header to
  // give up its blur. `document` is absent during the server render, and the
  // panel only opens from a click, so this guard never disagrees across
  // hydration.
  const mounted = typeof document !== "undefined";

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

  if (!open || !mounted) return null;

  const isSide = placement === "side";
  const isInk = tone === "ink";

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* The backdrop is lighter for a side drawer than for a centred dialog.
          A drawer is a navigation surface, not a blocking prompt: the page stays
          readable behind it, so the visitor can keep their place and still
          dismiss by tapping outside. The dialog keeps the heavier scrim because
          it is asking for a decision. */}
      <div
        className={
          isSide
            ? "absolute inset-0 bg-ink-950/45"
            : isInk
              ? "absolute inset-0 bg-ink-950/70"
              : "absolute inset-0 bg-ink-950/50"
        }
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
            ? isInk
              ? "drawer-panel absolute right-0 top-0 flex h-full w-[min(18.75rem,82vw)] flex-col overflow-y-auto bg-ink-950 text-white shadow-overlay"
              : "drawer-panel absolute right-0 top-0 h-full w-[min(20rem,90vw)] overflow-y-auto bg-surface p-5 shadow-overlay"
            : "absolute left-1/2 top-1/2 w-[min(32rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-surface p-6 shadow-overlay"
        }
      >
        <div
          className={
            isInk
              ? "flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4"
              : "flex items-start justify-between gap-4"
          }
        >
          {heading ?? (
            <h2 className={isInk ? "text-lg font-semibold text-white" : "text-lg font-semibold text-ink-900"}>
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className={
              isInk
                ? "-mr-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-white/70 transition-soft hover:bg-white/10 hover:text-white"
                : "rounded-card p-1.5 text-muted transition-soft hover:bg-ink-50 hover:text-ink-900"
            }
          >
            <X aria-hidden="true" className="h-5 w-5" />
            <span className="visually-hidden">{closeLabel}</span>
          </button>
        </div>
        <div className={isInk ? "flex min-h-0 flex-1 flex-col px-5 py-4" : "mt-4"}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
