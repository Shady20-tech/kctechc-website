import { redirect } from "next/navigation";

import { MembershipDecisionForm } from "@/components/admin/MembershipDecisionForm";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadMembershipQueueResult } from "@/lib/real-estate/membership-loaders";
import {
  membershipStatusLabelKey,
  membershipTypeLabelKey,
} from "@/lib/real-estate/memberships";

export const dynamic = "force-dynamic";

/**
 * Admin: the membership review queue.
 *
 * Only applications awaiting a decision are listed. Approved, rejected and
 * suspended memberships are decided states, and re-deciding them from a queue
 * would offer an action whose outcome the reviewer cannot see here — the
 * suspension and reinstatement path belongs with the member's own record, not
 * with the pending queue.
 *
 * The page guard is a redirect for the experience; the real boundary is
 * `real_estate_memberships_write_staff` in the database, and `loadMembershipQueueResult`
 * independently returns nothing for a non-staff caller.
 */
export default async function AdminMembershipsPage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/login?next=%2Fadmin%2Freal-estate%2Fmemberships");
  }
  if (!state.profile || !isRealEstateAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const queueResult = await loadMembershipQueueResult();
  const queue = queueResult.ok ? queueResult.data : [];

  const labels: Record<string, string> = {
    decisionLabel: t("adminMemberships.decisionLabel"),
    decisionApprove: t("adminMemberships.decisionApprove"),
    decisionReject: t("adminMemberships.decisionReject"),
    decisionRequestChanges: t("adminMemberships.decisionRequestChanges"),
    decisionSuspend: t("adminMemberships.decisionSuspend"),
    decisionReinstate: t("adminMemberships.decisionReinstate"),
    notesLabel: t("adminMemberships.notesLabel"),
    notesHint: t("adminMemberships.notesHint"),
    notesRequiredHint: t("adminMemberships.notesRequiredHint"),
    save: t("adminMemberships.save"),
    saving: t("adminMemberships.saving"),
    decisionSaved: t("adminMemberships.decisionSaved"),
    "errors.forbidden": t("errors.forbidden"),
    "errors.write_failed": t("errors.write_failed"),
    "errors.invalid_decision": t("errors.invalid_decision"),
    "errors.notes_required": t("errors.notes_required"),
  };

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("adminMemberships.heading")}
        intro={t("adminMemberships.intro")}
        back={{
          href: "/admin/real-estate",
          label: t("common.backTo", { destination: t("adminNav.realEstate") }),
        }}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/admin/real-estate" variant="secondary">
          {t("realEstate.admin.heading")}
        </ButtonLink>
      </div>

      <div className="mt-10">
        {!queueResult.ok ? (
          <Notice tone="warning" title={t("adminMemberships.heading")}>
            <p>
              {queueResult.reason === "unconfigured"
                ? t("errors.unconfigured")
                : t("errors.read_failed")}
            </p>
            <p className="mt-2 break-words font-mono text-xs">
              {queueResult.detail}
            </p>
          </Notice>
        ) : queue.length === 0 ? (
          <Notice tone="info" title={t("adminMemberships.heading")}>
            {t("adminMemberships.empty")}
          </Notice>
        ) : (
          <ul className="flex flex-col gap-6">
            {queue.map((entry) => (
              <li key={entry.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-ink-900">
                        {entry.fullName ??
                          t("adminMemberships.unnamedApplicant")}
                      </h2>
                      {entry.email ? (
                        <p className="font-mono text-sm text-muted">
                          {entry.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">
                        {t(membershipTypeLabelKey(entry.membershipType))}
                      </Badge>
                      <Badge tone="neutral">
                        {t(membershipStatusLabelKey(entry.status))}
                      </Badge>
                    </div>
                  </div>

                  {entry.kycReference ? (
                    <p className="mt-3 font-mono text-sm text-body">
                      {t("adminMemberships.kycReference")}: {entry.kycReference}
                    </p>
                  ) : null}

                  {entry.reviewNotes ? (
                    <div className="mt-3">
                      <Notice tone="info">
                        {t("adminMemberships.previousNotes")}:{" "}
                        {entry.reviewNotes}
                      </Notice>
                    </div>
                  ) : null}

                  <MembershipDecisionForm
                    membershipId={entry.id}
                    labels={labels}
                  />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
