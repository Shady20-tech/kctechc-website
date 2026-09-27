import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Super-admin: who can reach the console.
 *
 * The list is restricted to roles that grant console access (`ADMIN_ROLES`) rather
 * than showing every profile: this is an access review, and a page of customers
 * would bury the accounts that matter. The read goes through the cookie-bound
 * client, so the `profiles` policies decide what is visible.
 *
 * There is no inline role editor by design. A role change is a privileged,
 * audited operation; it belongs to the role-change action that writes a system-log
 * entry, not to a table cell whose last write would leave no trace.
 */
export default async function AdminUsersPage() {
  await requireRole(["super_admin"], "/admin/users");
  const t = createTranslator("en").t;

  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, role, phone, is_active")
        .in("role", [...ADMIN_ROLES])
        .order("full_name", { ascending: true })
    : { data: [] };

  const rows = data ?? [];

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.users")}
        heading={t("adminUsers.heading")}
        intro={t("adminUsers.intro")}
      />

      <Notice tone="info" title={t("adminUsers.noteHeading")}>
        {t("adminUsers.noteBody")}
      </Notice>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface">
        <DataTable<(typeof rows)[number]>
          caption={t("adminUsers.heading")}
          scrollLabel={t("adminUsers.heading")}
          getRowKey={(row) => row.id}
          rowHeaderKey="name"
          columns={[
            {
              key: "name",
              header: t("adminUsers.colName"),
              render: (row) => row.full_name ?? t("adminUsers.unassigned"),
            },
            {
              key: "email",
              header: t("adminUsers.colEmail"),
              render: (row) => row.email ?? t("adminUsers.unassigned"),
            },
            {
              key: "role",
              header: t("adminUsers.colRole"),
              render: (row) => <Badge tone="info">{t(`roleName.${row.role}`)}</Badge>,
            },
            {
              key: "phone",
              header: t("adminUsers.colPhone"),
              render: (row) => row.phone ?? t("adminUsers.unassigned"),
            },
            {
              key: "status",
              header: t("adminUsers.colStatus"),
              render: (row) => (
                <Badge tone={row.is_active ? "success" : "neutral"}>
                  {row.is_active ? t("adminUsers.statusActive") : t("adminUsers.statusInactive")}
                </Badge>
              ),
            },
          ]}
          rows={rows}
          emptyMessage={t("adminUsers.empty")}
        />
      </div>
    </>
  );
}
