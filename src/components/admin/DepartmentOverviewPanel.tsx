import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardHeading } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { Notice } from "@/components/ui/Notice";
import { canAccessDepartment, type AppRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * A department's console overview.
 *
 * Digital Marketing and Electrical Services have the same shape of job — author
 * finished work, keep the catalogue current, answer enquiries — so they share one
 * panel rather than two near-identical pages that would drift. Real estate keeps
 * its own page because its overview carries listing lifecycle counts and a
 * portfolio table that neither of these departments has.
 *
 * `counts` are passed in already loaded, and an empty list means "the query
 * failed or returned nothing", which is rendered as an honest empty state rather
 * than as zeroes that imply the department is idle. That is the same rule the
 * public content loaders follow.
 */
export type DepartmentOverviewPanelProps = {
  slug: string;
  role: AppRole;
  titleKey: string;
  introKey: string;
  counts: readonly { key: string; value: number }[];
  actions: readonly { href: string; labelKey: string }[];
  /** True when this department has a store catalogue to manage. */
  hasStore: boolean;
  /** True when this department has a Work Done projects surface. */
  hasProjects: boolean;
  /** An optional analytics block rendered before the quick actions. */
  report?: ReactNode;
};

/** Guard shared by both department pages, so neither can forget the check. */
export function canOpenDepartmentConsole(role: AppRole, slug: string): boolean {
  return canAccessDepartment(role, slug);
}

export function DepartmentOverviewPanel({
  slug,
  role,
  titleKey,
  introKey,
  counts,
  actions,
  hasStore,
  hasProjects,
  report,
}: DepartmentOverviewPanelProps) {
  const t = createTranslator("en").t;

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.sectionDepartments")}
        heading={t(titleKey)}
        intro={t(introKey)}
        back={{
          href: "/admin",
          label: t("common.backTo", { destination: t("adminNav.dashboard") }),
        }}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map((count) => (
          <Card key={count.key}>
            <p className="text-sm text-muted">{t(count.key)}</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink-900">
              {count.value}
            </p>
          </Card>
        ))}
      </div>

      {report ? <div className="mt-8">{report}</div> : null}

      <Card className="mt-8">
        <CardHeading>{t("adminDashboard.quickActions")}</CardHeading>
        <ul className="mt-4 flex flex-wrap gap-3 text-sm">
          {actions.map((action) => (
            <li key={action.href}>
              <Link
                href={action.href}
                className="inline-flex items-center rounded-control border border-border-strong px-3 py-2 text-body transition-soft hover:border-dept-accent hover:text-dept-accent"
              >
                {t(action.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {hasStore ? (
          <Card>
            <CardHeading>{t("adminNav.store")}</CardHeading>
            <p className="mt-2 text-sm text-body">
              {t("adminDepartments.storeBody")}
            </p>
            <Link
              href="/admin/store/new"
              className="mt-4 inline-flex items-center rounded-control border border-border-strong px-3 py-2 text-sm text-body transition-soft hover:border-dept-accent hover:text-dept-accent"
            >
              {t("adminDepartments.addProduct")}
            </Link>
          </Card>
        ) : null}

        {hasProjects ? (
          <Card>
            <CardHeading>{t("adminNav.work")}</CardHeading>
            <p className="mt-2 text-sm text-body">
              {t("adminDepartments.projectsBody")}
            </p>
            <Link
              href="/admin/work/new"
              className="mt-4 inline-flex items-center rounded-control border border-border-strong px-3 py-2 text-sm text-body transition-soft hover:border-dept-accent hover:text-dept-accent"
            >
              {t("adminDepartments.addProject")}
            </Link>
          </Card>
        ) : null}
      </div>

      {/*
        The department boundary is stated on the page, not only enforced in the
        policy. A staff member who lands here from a cross-department link should
        be able to see what this console is scoped to without guessing.
      */}
      <Notice tone="info" title={t("adminDepartments.scopeHeading")}>
        <p>
          {t("adminDepartments.scopeBody", {
            department: t(`adminNav.${labelKeyFor(slug)}`),
          })}
        </p>
        <p className="mt-2 text-sm">
          {t("adminDepartments.roleNote", { role: t(`roleName.${role}`) })}
        </p>
      </Notice>
    </>
  );
}

/** The nav label key for a department slug, so the scope notice can name it. */
function labelKeyFor(slug: string): string {
  if (slug === "digital-marketing") return "digitalMarketing";
  if (slug === "electrical-services") return "electricalServices";
  return "realEstate";
}
