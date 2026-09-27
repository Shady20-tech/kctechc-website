import { notFound } from "next/navigation";

import { InquiryUpdateForm } from "@/components/admin/InquiryUpdateForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireAdmin } from "@/lib/auth/guards";
import { getCrmInquiry, listAssignees } from "@/lib/crm/queries";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/** Admin: a single enquiry, its message, its timeline, and the update form. */
export default async function AdminCrmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("/admin/crm");
  const { id } = await params;
  const t = createTranslator("en").t;

  const inquiry = await getCrmInquiry(id);
  if (!inquiry) notFound();

  const assignees = await listAssignees();

  const labels: Record<string, string> = {
    updateHeading: t("adminCrm.updateHeading"),
    updateIntro: t("adminCrm.updateIntro"),
    statusLabel: t("adminCrm.statusLabel"),
    priorityLabel: t("adminCrm.priorityLabel"),
    typeLabel: t("adminCrm.typeLabel"),
    assignLabel: t("adminCrm.assignLabel"),
    assignUnassigned: t("adminCrm.assignUnassigned"),
    noteLabel: t("adminCrm.noteLabel"),
    noteHint: t("adminCrm.noteHint"),
    applyUpdate: t("adminCrm.applyUpdate"),
    noChange: t("adminCrm.noChange"),
    applied: t("adminCrm.applied"),
    "errors.unauthenticated": t("adminCrm.errors.unauthenticated"),
    "errors.forbidden": t("adminCrm.errors.forbidden"),
    "errors.not_found": t("adminCrm.errors.not_found"),
    "errors.invalid_status": t("adminCrm.errors.invalid_status"),
    "errors.invalid_priority": t("adminCrm.errors.invalid_priority"),
    "errors.invalid_type": t("adminCrm.errors.invalid_type"),
    "errors.note_too_long": t("adminCrm.errors.note_too_long"),
    "errors.update_failed": t("adminCrm.errors.update_failed"),
    "errors.unconfigured": t("adminCrm.errors.unconfigured"),
    "status.new": t("inquiryStatus.new"),
    "status.assigned": t("inquiryStatus.assigned"),
    "status.in_progress": t("inquiryStatus.in_progress"),
    "status.responded": t("inquiryStatus.responded"),
    "status.closed": t("inquiryStatus.closed"),
    "status.spam": t("inquiryStatus.spam"),
  };

  const { row, events } = inquiry;

  return (
    <>
      <PageIntro
        eyebrow={row.departmentName ?? t("adminNav.crm")}
        heading={t("adminCrm.detailHeading", { reference: row.reference })}
        intro={row.subject ?? undefined}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold text-ink-900">
              {t("adminCrm.messageHeading")}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-body">
              {inquiry.message ?? "—"}
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-ink-900">
              {t("adminCrm.timelineHeading")}
            </h2>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("adminCrm.noTimeline")}</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {events.map((event) => (
                  <li key={event.id} className="border-l-2 border-border pl-4">
                    <p className="text-sm font-medium text-ink-900">
                      {event.eventType}
                      {event.fromStatus && event.toStatus
                        ? `: ${event.fromStatus} → ${event.toStatus}`
                        : ""}
                    </p>
                    {event.note ? (
                      <p className="mt-1 text-sm text-body">{event.note}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-ink-900">
              {t("adminCrm.detailsHeading")}
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Detail label={t("adminCrm.columnContact")} value={row.fullName ?? "—"} />
              <Detail label="Email" value={row.email ?? "—"} />
              <Detail label="Phone" value={inquiry.phone ?? "—"} />
              <Detail
                label={t("adminCrm.columnReceived")}
                value={formatDateTime(row.createdAt)}
              />
              <Detail
                label={t("adminCrm.consentLabel")}
                value={
                  inquiry.consentGiven
                    ? inquiry.consentAt
                      ? t("adminCrm.consentAt", { date: formatDate(inquiry.consentAt) })
                      : "—"
                    : "—"
                }
              />
              <div>
                <dt className="text-muted">{t("adminCrm.columnStatus")}</dt>
                <dd className="mt-1">
                  <Badge tone="info">{t(`inquiryStatus.${row.status}`)}</Badge>
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <InquiryUpdateForm
              id={row.id}
              current={{
                status: row.status,
                priority: row.priority,
                inquiryType: row.inquiryType,
                assignedTo: row.assignedTo,
              }}
              assignees={assignees}
              labels={labels}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink-900">{value}</dd>
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}
