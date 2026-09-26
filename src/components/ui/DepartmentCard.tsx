import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { DepartmentIcon } from "@/components/ui/DepartmentIcon";
import type { DepartmentDefinition } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Department gateway card.
 *
 * The corporate gateway's primary decision point, so it carries more visual
 * weight than a generic card: a large accent-lit icon plate, a display-weight
 * heading, a numbered index and a full-width accent edge that fills on hover.
 *
 * All three cards use identical structure and sizing, so no department is
 * visually promoted over the others. Identity comes from the single
 * `--dept-accent` variable — the icon plate, edge, index and arrow all read it —
 * which keeps one visual language rather than three.
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
  index,
}: {
  department: DepartmentDefinition;
  locale: Locale;
  label: string;
  summary: string;
  actionLabel: string;
  /** Position in the department set, shown as a technical index. */
  index: number;
}) {
  return (
    <li className="h-full" {...departmentScopeProps(department.slug)}>
      <Link
        href={`/${locale}/${department.slug}`}
        className="card-edge hover-lift group flex h-full flex-col rounded-card border border-border bg-surface p-7 shadow-card transition-soft hover:border-border-strong hover:shadow-raised"
      >
        <div className="flex items-start justify-between gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-ink-950 text-white transition-soft group-hover:bg-dept-accent"
          >
            <DepartmentIcon slug={department.icon} className="h-7 w-7" />
          </span>
          <span
            aria-hidden="true"
            className="mono-label pt-1 text-ink-300 transition-soft group-hover:text-dept-accent"
          >
            {String(index).padStart(2, "0")}
          </span>
        </div>

        <h3 className="mt-6 font-display text-xl font-bold tracking-tight text-ink-900">
          {label}
        </h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-body">
          {summary}
        </p>

        <span className="hairline mt-6 flex items-center justify-between pt-5">
          <span className="text-sm font-semibold text-ink-900">
            {actionLabel}
          </span>
          <span
            aria-hidden="true"
            className="card-arrow flex h-8 w-8 items-center justify-center rounded-pill border border-border-strong text-ink-900 transition-soft group-hover:border-dept-accent group-hover:bg-dept-accent group-hover:text-white"
          >
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </span>
      </Link>
    </li>
  );
}
