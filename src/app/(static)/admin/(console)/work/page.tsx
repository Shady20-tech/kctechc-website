import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireRole } from "@/lib/auth/guards";
import { DEPARTMENT_EDITOR_ROLES } from "@/lib/auth/roles";
import { listAdminProjects } from "@/lib/content/project-admin-queries";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Admin: completed work ("Work Done"), across the departments the caller may edit.
 *
 * The list is scoped by the RLS policy, so a Digital Marketing editor sees only
 * Digital Marketing work even though published projects from other departments are
 * world-readable. The department column makes that scope visible rather than
 * implicit.
 */
export default async function AdminWorkPage() {
  const profile = await requireRole(
    [...DEPARTMENT_EDITOR_ROLES],
    "/admin/work",
  );
  const t = createTranslator("en").t;
  const rows = await listAdminProjects(profile.role);

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.work")}
        heading={t("adminWork.heading")}
        intro={t("adminWork.intro")}
      />

      <div className="mt-8">
        <ButtonLink href="/admin/work/new" variant="primary">
          {t("adminWork.newProject")}
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <Notice tone="info" title={t("adminWork.emptyHeading")}>
            <p>{t("adminWork.emptyBody")}</p>
          </Notice>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface">
          <DataTable<(typeof rows)[number]>
            caption={t("adminWork.heading")}
            scrollLabel={t("adminWork.heading")}
            getRowKey={(row) => row.id}
            rowHeaderKey="title"
            columns={[
              {
                key: "title",
                header: t("adminWork.colTitle"),
                render: (row) => (
                  <Link
                    href={`/admin/work/${row.id}`}
                    className="font-medium text-dept-accent underline"
                  >
                    {row.title}
                  </Link>
                ),
              },
              {
                key: "department",
                header: t("adminWork.colDepartment"),
                render: (row) => row.departmentName || "—",
              },
              {
                key: "completed",
                header: t("adminWork.colCompleted"),
                render: (row) =>
                  row.completedYear ? String(row.completedYear) : "—",
              },
              {
                key: "media",
                header: t("adminWork.colMedia"),
                render: (row) => String(row.mediaCount),
              },
              {
                key: "state",
                header: t("adminWork.colState"),
                render: (row) => (
                  <Badge
                    tone={
                      row.publishState === "published"
                        ? "success"
                        : row.publishState === "archived"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {t(`adminWork.state.${row.publishState}`)}
                  </Badge>
                ),
              },
              {
                key: "updated",
                header: t("adminWork.colUpdated"),
                render: (row) => formatDate(row.updatedAt),
              },
            ]}
            rows={rows}
            emptyMessage={t("adminWork.emptyHeading")}
          />
        </div>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}
