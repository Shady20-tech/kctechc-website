"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DEPARTMENTS, type DepartmentSlug } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Department switcher.
 *
 * A disclosure rather than a `<select>`: it needs to carry an active marker and
 * a colour key per option, none of which a native select can render. Implemented
 * as a button with `aria-expanded`/`aria-controls`, closes on Escape and on
 * outside click, and returns focus to the trigger on close.
 */
export function DepartmentSwitcher({
  locale,
  labels,
  current,
  label,
  currentLabel,
}: {
  locale: Locale;
  labels: Record<DepartmentSlug, string>;
  current?: DepartmentSlug;
  label: string;
  currentLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const currentDepartment = DEPARTMENTS.find((d) => d.slug === current);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="department-switcher-menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-card border border-border-strong px-3 py-2 text-sm font-medium text-navy-900 transition-soft hover:border-navy-500"
      >
        <span className="max-w-[9rem] truncate">
          {currentDepartment ? labels[currentDepartment.slug] : label}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-soft ${open ? "rotate-180" : ""}`}
        />
        {currentDepartment ? (
          <span className="visually-hidden"> ({currentLabel})</span>
        ) : null}
      </button>

      {open ? (
        <div
          id="department-switcher-menu"
          className="absolute right-0 z-40 mt-2 w-72 rounded-card border border-border bg-surface p-2 shadow-overlay"
        >
          <ul>
            {DEPARTMENTS.map((department) => {
              const isCurrent = department.slug === current;
              return (
                <li key={department.slug}>
                  <Link
                    href={`/${locale}/${department.slug}`}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-card px-3 py-2 transition-soft hover:bg-surface-alt"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: department.accent }}
                    />
                    <span className="flex flex-1 items-center gap-2">
                      <span className="text-sm font-medium text-navy-900">
                        {labels[department.slug]}
                      </span>
                      {isCurrent ? (
                        <Check
                          aria-hidden="true"
                          className="h-4 w-4 text-dept-accent"
                        />
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
