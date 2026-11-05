import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { RoleSelectForm } from "@/components/admin/RoleSelectForm";
import { requireRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Super-admin: who can reach the console, and what role they hold.
 *
 * The default list is restricted to roles that grant console access
 * (`ADMIN_ROLES`) rather than showing every profile: this is an access review,
 * and a page of customers would bury the accounts that matter.
 *
 * `?q=` searches **all** profiles, not just the admin-capable ones. That is the
 * point of the search: promoting a new staff member starts from an ordinary
 * `customer` account created by sign-up, so a filter that only ever showed
 * existing admins would make the account you need to promote the one account you
 * cannot find. The read still goes through the cookie-bound client, so
 * `profiles_select_admin` decides what is visible.
 *
 * The role change itself is not performed here: `RoleSelectForm` posts to
 * `changeUserRoleAction`, which re-authorizes, validates and audits before the
 * write. A table cell is not a control.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const auth = await requireRole(["super_admin"], "/admin/users");
  const t = createTranslator("en").t;

  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 120);

  const supabase = await createClient();

  // PostgREST `or` filters are a grammar, not a literal string, so the characters
  // that carry meaning in it are removed rather than escaped. Without this a
  // comma or bracket in `q` would restructure the filter instead of being
  // searched for.
  const safeQuery = query.replace(/[,()*%\\]/g, " ").trim();

  // The default list is the access review; a search replaces it. `safeQuery`
  // rather than `query` decides that, so a query made only of filter punctuation
  // (`%%%`) falls back to the access review instead of matching every profile.
  const base = supabase
    ? safeQuery
      ? supabase
          .from("profiles")
          .select("id, full_name, email, role, is_active")
          .or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
      : supabase
          .from("profiles")
          .select("id, full_name, email, role, is_active")
          .in("role", [...ADMIN_ROLES])
    : null;

  const { data } = base
    ? await base.order("full_name", { ascending: true }).limit(200)
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

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label htmlFor="q" className="min-w-56 flex-1">
          <span className="block text-sm font-medium text-ink-900">
            {t("adminUsers.searchLabel")}
          </span>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={t("adminUsers.searchPlaceholder")}
            className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900 transition-soft placeholder:text-muted hover:border-ink-500 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </label>
        <button
          type="submit"
          className="rounded-control border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink-900 transition-soft hover:bg-surface-alt"
        >
          {t("adminUsers.searchSubmit")}
        </button>
      </form>

      {safeQuery ? (
        <p className="mt-3 text-sm text-muted">
          {t("adminUsers.searchResults")} “{query}”
        </p>
      ) : null}

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
              key: "status",
              header: t("adminUsers.colStatus"),
              render: (row) => (
                <Badge tone={row.is_active ? "success" : "neutral"}>
                  {row.is_active ? t("adminUsers.statusActive") : t("adminUsers.statusInactive")}
                </Badge>
              ),
            },
            {
              key: "change",
              header: t("adminUsers.colChangeRole"),
              render: (row) => (
                <RoleSelectForm
                  profileId={row.id}
                  currentRole={row.role}
                  isSelf={row.id === auth.id}
                  locale="en"
                />
              ),
            },
          ]}
          rows={rows}
          emptyMessage={query ? t("adminUsers.searchEmpty") : t("adminUsers.empty")}
        />
      </div>
    </>
  );
}
