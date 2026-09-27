import { redirect } from "next/navigation";

import { SubmissionDecisionForm } from "@/components/admin/SubmissionDecisionForm";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadListingSubmissions } from "@/lib/real-estate/loaders";

export const dynamic = "force-dynamic";

/**
 * Admin: the owner submission queue.
 *
 * Rendered as a stack of cards rather than a table. Each item carries a decision
 * form, and a table cell is the wrong container for a form; the card also gives
 * the owner's own words room to be read, which is what the reviewer is actually
 * deciding on.
 *
 * Only the pending queue is shown. Approved and rejected items are decided, and
 * re-deciding them is refused by the database, so presenting them here would
 * offer an action that cannot succeed.
 */
export default async function AdminSubmissionsPage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Freal-estate%2Fsubmissions");
  }
  if (!state.profile || !isRealEstateAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const submissions = await loadListingSubmissions("pending_review");

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.admin.submissionsHeading")}
        intro={t("realEstate.admin.submissionsIntro")}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/admin/real-estate" variant="secondary">
          {t("realEstate.admin.heading")}
        </ButtonLink>
      </div>

      <div className="mt-10">
        {submissions.length === 0 ? (
          <Notice tone="info" title={t("realEstate.admin.submissionsHeading")}>
            <p>{t("realEstate.admin.noSubmissions")}</p>
          </Notice>
        ) : (
          <ul className="space-y-6">
            {submissions.map((submission) => (
              <li key={submission.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <CardHeading>
                      {t("realEstate.admin.submissionFor", {
                        reference: submission.listingReference,
                        title: submission.listingTitle,
                      })}
                    </CardHeading>
                    <Badge>{t(`realEstate.statuses.${submission.status}`)}</Badge>
                  </div>

                  <p className="mt-3 text-sm text-body">
                    {t("realEstate.admin.submissionSubmittedBy", {
                      name: submission.submitterName,
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {t("realEstate.admin.submissionContact", {
                      email: submission.submitterEmail ?? "—",
                      phone: submission.submitterPhone ?? "—",
                    })}
                  </p>

                  {submission.notes ? (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-ink-900">
                        {t("realEstate.admin.submissionNotes")}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-body">
                        {submission.notes}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-6 border-t border-border pt-6">
                    <SubmissionDecisionForm
                      submissionId={submission.id}
                      locale="en"
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
