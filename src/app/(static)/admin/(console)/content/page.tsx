import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PageIntro } from "@/components/ui/PageIntro";
import { listAdminInsights } from "@/lib/content/admin-queries";
import { requireRole } from "@/lib/auth/guards";
import { CONTENT_MANAGER_ROLES } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/** Admin: the article list, including drafts. */
export default async function AdminContentPage() {
  await requireRole([...CONTENT_MANAGER_ROLES], "/admin/content");
  const t = createTranslator("en").t;
  const rows = await listAdminInsights();

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.content")}
        heading={t("adminContent.heading")}
        intro={t("adminContent.intro")}
      />

      <div className="mt-8">
        <ButtonLink href="/admin/content/new" variant="primary">
          {t("adminContent.newArticle")}
        </ButtonLink>
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface">
        <DataTable<(typeof rows)[number]>
          caption={t("adminContent.heading")}
          scrollLabel={t("adminContent.heading")}
          getRowKey={(row) => row.id}
          rowHeaderKey="title"
          columns={[
            {
              key: "title",
              header: t("adminContent.colTitle"),
              render: (row) => (
                <Link
                  href={`/admin/content/${row.id}`}
                  className="font-medium text-dept-accent underline"
                >
                  {row.title}
                </Link>
              ),
            },
            {
              key: "category",
              header: t("adminContent.colCategory"),
              render: (row) => row.categoryName ?? "—",
            },
            {
              key: "department",
              header: t("adminContent.colDepartment"),
              render: (row) => row.departmentName ?? "—",
            },
            {
              key: "author",
              header: t("adminContent.colAuthor"),
              render: (row) => row.authorName ?? "—",
            },
            {
              key: "state",
              header: t("adminContent.colState"),
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
                  {t(`adminContent.state.${row.publishState}`)}
                </Badge>
              ),
            },
            {
              key: "updated",
              header: t("adminContent.colUpdated"),
              render: (row) => formatDate(row.updatedAt),
            },
          ]}
          rows={rows}
          emptyMessage={t("adminContent.empty")}
        />
      </div>
    </>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}
