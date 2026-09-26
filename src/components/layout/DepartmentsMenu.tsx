"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export type NavMenuItems = readonly { href: string; label: string }[];

/**
 * Departments dropdown for the desktop header.
 *
 * The panel is always in the DOM and is hidden with CSS, never unmounted. That is
 * deliberate: the department links stay real anchors that a crawler can follow and
 * that keep working if JavaScript fails to load. Rendering the panel only while
 * open would hide three indexable pages from search engines for the sake of a
 * shorter DOM.
 *
 * Because CSS owns visibility, the menu also opens on hover and on
 * `:focus-within`. Keyboard users therefore never depend on the toggle's click
 * handler: tabbing to the trigger opens the panel, and tabbing onward moves
 * through the links. The button additionally supports click, Escape and
 * outside-click, which is what pointer and touch users expect.
 *
 * `aria-expanded` tracks the click state only. Hover and focus visibility are
 * presentational, so they do not claim an expanded state the keyboard user did
 * not ask for.
 */
export function DepartmentsMenu({
  label,
  ariaLabel,
  items,
}: {
  label: string;
  ariaLabel: string;
  items: NavMenuItems;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="nav-menu group relative"
      data-open={open ? "true" : "false"}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="nav-menu-trigger inline-flex items-center gap-1 rounded-card px-3 py-2 text-sm font-medium text-white/75 transition-soft hover:bg-white/5 hover:text-white"
      >
        {label}
        <ChevronDown aria-hidden="true" className="nav-menu-chevron h-3.5 w-3.5" />
      </button>

      <div
        id={menuId}
        aria-label={ariaLabel}
        className="nav-menu-panel absolute left-0 top-full z-50 min-w-56 pt-2"
      >
        <ul className="overflow-hidden rounded-card border border-white/10 bg-ink-900 py-1 shadow-raised">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-white/75 transition-soft hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
