import Link from "next/link";
import type { DepartmentDefinition } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Department gateway card. The accent bar is the only place a department colour
 * is used at full strength, which keeps the corporate identity dominant.
 */
export function DepartmentCard({
  department,
  locale,
  label,
  description,
  actionLabel,
}: {
  department: DepartmentDefinition;
  locale: Locale;
  label: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <li className="h-full">
      <Link
        href={`/${locale}/${department.slug}`}
        className="flex h-full flex-col rounded-card border border-border bg-surface p-6 transition-shadow hover:shadow-md"
        style={{ borderTopColor: department.accent, borderTopWidth: "4px" }}
      >
        <h3 className="text-lg font-semibold text-navy-900">{label}</h3>
        <p className="mt-2 flex-1 text-sm text-body">{description}</p>
        <span className="mt-4 text-sm font-medium text-navy-700">
          {actionLabel} →
        </span>
      </Link>
    </li>
  );
}
