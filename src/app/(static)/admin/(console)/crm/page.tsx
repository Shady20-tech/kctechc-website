import Link from "next/link";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { PageIntro } from "@/components/ui/PageIntro";
import {
  crmSummary,
  isInquiryPriority,
  isInquiryStatus,
  isInquiryType,
  listCrmInbox,
} from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Admin: the unified enquiry inbox.
 *
 * Server-rendered with query-string filters so a view is a reloadable URL, which
 * matters for an operational queue a team member may want to bookmark or share.
 * The summary strip above the table is the same data the dashboard card reads, so
 * the two cannot disagree.
 */
export default async function AdminCrmPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    department?: string;
    type?: string;
  }>;
}) {
  await requireAdmin("/admin/crm");
  const t = createTranslator("en").t;
  const { status, priority, department, type } = await searchParams;

  // Narrow the free-text query values to the database's own enums before they
  // reach a query. An unrecognised value is dropped rather than passed through,
  // so a hand-edited URL cannot force a query the view does not support.
  const statusFilter = isInquiryStatus(status) ? status : undefined;
  const priorityFilter = isInquiryPriority(priority) ? priority : undefined;
  const typeFilter = isInquiryType(type) ? type : undefined;

  const [rows, summary] = await Promise.all([
    listCrmInbox({
      status: statusFilter,
      priority: priorityFilter,
      department: department || undefined,
      type: typeFilter,
    }),
    crmSummary(),
  ]);

  const activeFilters = [
    statusFilter ? { key: "status", label: t(`inquiryStatus.${statusFilter}`) } : null,
    priorityFilter ? { key: "priority", label: priorityFilter } : null,
    department ? { key: "department", label: department } : null,
    typeFilter ? { key: "type", label: typeFilter } : null,
  ].filter((entry): entry is { key: string; label: string } => entry !== null);

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.crm")}
        heading={t("adminCrm.heading")}
        intro={t("adminCrm.intro")}
      />

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={t("adminDashboardCards.inquiriesHeading")}
          value={summary.reduce((total, entry) => total + entry.total, 0)}
        />
        <SummaryCard
          label={t("adminDashboardCards.awaitingReply", { count: "" })}
          value={summary.reduce((total, entry) => total + entry.awaiting, 0)}
        />
        <SummaryCard
          label={t("adminCrm.columnPriority")}
          value={summary.reduce((total, entry) => total + entry.escalated, 0)}
        />
        <SummaryCard label={t("adminCrm.columnDepartment")} value={summary.length} />
      </dl>

      <nav
        aria-label={t("adminCrm.filterStatus")}
        className="mt-8 flex flex-wrap items-center gap-2"
      >
        <FilterLink href="/admin/crm" label={t("adminCrm.allStatuses")} active={!status} />
        {["new", "assigned", "in_progress", "responded", "closed", "spam"].map((value) => (
          <FilterLink
            key={value}
            href={`/admin/crm?status=${value}`}
            label={t(`inquiryStatus.${value}`)}
            active={status === value}
          />
        ))}
      </nav>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface">
        <DataTable<(typeof rows)[number]>
          caption={t("adminCrm.heading")}
          scrollLabel={t("adminCrm.heading")}
          getRowKey={(row) => row.id}
          rowHeaderKey="reference"
          columns={[
            {
              key: "reference",
              header: t("adminCrm.columnReference"),
              render: (row) => (
                <Link
                  href={`/admin/crm/${row.id}`}
                  className="font-mono text-sm text-dept-accent underline"
                >
                  {row.reference}
                </Link>
              ),
            },
            {
              key: "contact",
              header: t("adminCrm.columnContact"),
              render: (row) => (
                <span>
                  <span className="block text-ink-900">{row.fullName ?? "—"}</span>
                  <span className="block text-xs text-muted">{row.email ?? ""}</span>
                </span>
              ),
            },
            {
              key: "department",
              header: t("adminCrm.columnDepartment"),
              render: (row) => row.departmentName ?? "—",
            },
            {
              key: "type",
              header: t("adminCrm.columnType"),
              render: (row) => <Badge tone="neutral">{row.inquiryType}</Badge>,
            },
            {
              key: "priority",
              header: t("adminCrm.columnPriority"),
              render: (row) => (
                <Badge tone={priorityTone(row.priority)}>{row.priority}</Badge>
              ),
            },
            {
              key: "status",
              header: t("adminCrm.columnStatus"),
              render: (row) => (
                <Badge tone={statusTone(row.status)}>{t(`inquiryStatus.${row.status}`)}</Badge>
              ),
            },
            {
              key: "assigned",
              header: t("adminCrm.columnAssigned"),
              render: (row) => row.assigneeName ?? t("adminCrm.unassigned"),
            },
            {
              key: "awaiting",
              header: t("adminCrm.columnAwaiting"),
              render: (row) =>
                row.awaitingResponse ? (
                  <Badge tone="warning">{t("adminCrm.awaitingYes")}</Badge>
                ) : (
                  <span className="text-muted">{t("adminCrm.awaitingNo")}</span>
                ),
            },
          ]}
          rows={rows}
          emptyMessage={t("adminCrm.empty")}
        />
      </div>

      {activeFilters.length > 0 ? (
        <p className="mt-4 text-sm text-muted">
          {activeFilters.map((entry) => entry.label).join(" · ")}
        </p>
      ) : null}
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold text-ink-900">{value}</dd>
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-pill border px-3 py-1 text-sm ${
        active
          ? "border-dept-accent text-dept-accent"
          : "border-border-strong text-body"
      }`}
    >
      {label}
    </Link>
  );
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "responded":
    case "closed":
      return "success";
    case "in_progress":
    case "assigned":
      return "info";
    case "new":
      return "warning";
    case "spam":
      return "danger";
    default:
      return "neutral";
  }
}

function priorityTone(priority: string): BadgeTone {
  switch (priority) {
    case "urgent":
      return "danger";
    case "high":
      return "warning";
    case "low":
      return "neutral";
    default:
      return "info";
  }
}
