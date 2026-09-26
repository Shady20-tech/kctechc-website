"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import {
  DEPARTMENTS,
  isDepartmentSlug,
  type DepartmentSlug,
} from "@/lib/config/site";
import { useStoredValue } from "@/lib/hooks/use-client-environment";
import type { Locale } from "@/lib/i18n/locales";

const STORAGE_KEY = "kc:last-department";

/**
 * Last-visited department memory.
 *
 * Part of the smart-routing behaviour: a returning visitor who has already shown
 * a department preference gets a one-click route back to it.
 *
 * Two deliberate constraints keep this from breaking the gateway rule:
 *
 * 1. It never redirects. The gateway stays the language-neutral corporate entry
 *    point and always renders all three departments at equal weight; this is an
 *    optional shortcut offered *in addition*, never instead.
 * 2. It is purely client-side and additive. With JavaScript disabled or storage
 *    unavailable (private mode, blocked cookies) nothing renders and the gateway
 *    is unaffected, so there is no degraded or broken state.
 */
export function RememberDepartment({ slug }: { slug: DepartmentSlug }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, slug);
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). The shortcut
      // is an enhancement, so a failure here is not an error.
    }
  }, [slug]);

  return null;
}

export function LastDepartmentShortcut({
  locale,
  heading,
  note,
  labels,
}: {
  locale: Locale;
  heading: string;
  note: string;
  labels: Record<DepartmentSlug, string>;
}) {
  const stored = useStoredValue(STORAGE_KEY);

  if (!stored || !isDepartmentSlug(stored)) return null;

  const department = DEPARTMENTS.find((entry) => entry.slug === stored);
  if (!department) return null;

  return (
    <aside className="mt-8 rounded-card border border-border bg-surface-alt p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {note}
      </p>
      <Link
        href={`/${locale}/${department.slug}`}
        className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-navy-900 transition-soft hover:text-dept-accent"
      >
        {heading.replace("{department}", labels[department.slug])}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </aside>
  );
}
