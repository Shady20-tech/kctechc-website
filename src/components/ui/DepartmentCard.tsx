import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DepartmentIcon } from "@/components/ui/DepartmentIcon";
import type { DepartmentDefinition } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Department gateway card.
 *
 * The accent appears as a top rule, an icon tint and the arrow, all driven by the
 * one `--dept-accent` variable — enough to identify the department without
 * creating a second visual language. All three cards use identical sizing and
 * weight, so no department is visually promoted over the others on the corporate
 * gateway.
 *
 * The whole card is one link, which gives a large touch target on mobile; the
 * "explore" text is a visual affordance rather than a nested link, avoiding two
 * tab stops for one destination.
 */
export function DepartmentCard({
  department,
  locale,
  label,
  summary,
  actionLabel,
}: {
  department: DepartmentDefinition;
  locale: Locale;
  label: string;
  summary: string;
  actionLabel: string;
}) {
  return (
    <li className="h-full">
      <Link
        href={`/${locale}/${department.slug}`}
        className="hover-lift flex h-full flex-col rounded-card border border-border bg-surface p-6 shadow-card transition-soft"
      >
        <span
          aria-hidden="true"
          className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-card bg-surface-alt text-dept-accent"
        >
          <DepartmentIcon slug={department.icon} className="h-6 w-6" />
        </span>
        <h3 className="text-lg font-semibold text-navy-900">{label}</h3>
        <p className="mt-2 flex-1 text-sm text-body">{summary}</p>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-navy-700">
          {actionLabel}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </span>
      </Link>
    </li>
  );
}
