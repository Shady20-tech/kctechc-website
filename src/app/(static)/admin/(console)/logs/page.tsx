import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PageIntro } from "@/components/ui/PageIntro";
import { listAuditFacets, listAuditLogs } from "@/lib/admin/logs";
import { requireRole } from "@/lib/auth/guards";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Super-admin: the system log.
 *
 * Restricted to `super_admin` because the trail records who changed what across
 * every department; a department administrator has no business reading another
 * department's history. The page is a server-rendered table with plain query-string
 * filters — no client state — so a filtered view is a shareable, reloadable URL.
 */
export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string }>;
}) {
  await requireRole(["super_admin"], "/admin/logs");
  const t = createTranslator("en").t;
  const { action, entity } = await searchParams;

  const [rows, facets] = await Promise.all([
    listAuditLogs({
      action: action || undefined,
      entityType: entity || undefined,
      limit: 200,
    }),
    listAuditFacets(),
  ]);

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.logs")}
        heading={t("adminLogs.heading")}
        intro={t("adminLogs.intro")}
      />

      <form
        method="get"
        className="mt-8 flex flex-wrap items-end gap-4"
        aria-label={t("adminLogs.filterAction")}
      >
        <div>
          <label htmlFor="action" className="block text-sm font-medium text-ink-900">
            {t("adminLogs.filterAction")}
          </label>
          <select
            id="action"
            name="action"
            defaultValue={action ?? ""}
            className="mt-1 rounded-card border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("adminLogs.allActions")}</option>
            {facets.actions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="entity" className="block text-sm font-medium text-ink-900">
            {t("adminLogs.filterEntity")}
          </label>
          <select
            id="entity"
            name="entity"
            defaultValue={entity ?? ""}
            className="mt-1 rounded-card border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("adminLogs.allEntities")}</option>
            {facets.entityTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-card bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-700"
        >
          {t("adminLogs.applyFilters")}
        </button>
        <ButtonLink href="/admin/logs" variant="ghost" size="md">
          {t("adminLogs.clearFilters")}
        </ButtonLink>
      </form>

      <p className="mt-6 text-sm text-muted">
        {t("adminLogs.limited", { count: rows.length })}
      </p>

      <div className="mt-2 overflow-hidden rounded-card border border-border bg-surface">
        <DataTable<(typeof rows)[number]>
          caption={t("adminLogs.heading")}
          scrollLabel={t("adminLogs.heading")}
          getRowKey={(row) => row.id}
          rowHeaderKey="when"
          columns={[
            {
              key: "when",
              header: t("adminLogs.columnWhen"),
              render: (row) => (
                <span className="whitespace-nowrap">{formatDateTime(row.createdAt)}</span>
              ),
            },
            {
              key: "actor",
              header: t("adminLogs.columnActor"),
              render: (row) =>
                row.actorId ? (
                  <span>
                    <span className="block font-medium text-ink-900">
                      {row.actorName ?? row.actorEmail ?? row.actorId}
                    </span>
                    {row.actorEmail ? (
                      <span className="block text-xs text-muted">{row.actorEmail}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted">{t("adminLogs.systemActor")}</span>
                ),
            },
            {
              key: "action",
              header: t("adminLogs.columnAction"),
              render: (row) => <Badge tone="info">{row.action}</Badge>,
            },
            {
              key: "entity",
              header: t("adminLogs.columnEntity"),
              render: (row) => (
                <span>
                  <span className="block text-ink-900">{row.entityType}</span>
                  {row.entityId ? (
                    <span className="block font-mono text-xs text-muted">
                      {row.entityId}
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              key: "metadata",
              header: t("adminLogs.columnMetadata"),
              render: (row) => (
                <span className="font-mono text-xs text-muted">
                  {Object.keys(row.metadata).length > 0
                    ? summarizeMetadata(row.metadata)
                    : t("adminLogs.noMetadata")}
                </span>
              ),
            },
          ]}
          rows={rows}
          emptyMessage={t("adminLogs.empty")}
        />
      </div>
    </>
  );
}

/** Render a metadata object as a compact, escaped key: value list. */
function summarizeMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(iso));
}
