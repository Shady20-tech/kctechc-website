import { redirect } from "next/navigation";

import { PublisherVerificationForm } from "@/components/admin/PublisherVerificationForm";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isKycReviewerRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadVerifiedMembershipCandidates } from "@/lib/real-estate/membership-loaders";
import {
  isVerifiedMembership,
  membershipTypeLabelKey,
} from "@/lib/real-estate/memberships";

export const dynamic = "force-dynamic";

/**
 * Admin: grant and revoke publisher verification badges.
 *
 * Super-admin only. A verification badge is a public trust mark, and the brief is
 * explicit that it must never be inferred from an approval — so this console lists
 * the *approved* memberships a super admin may choose to verify, not the pending
 * queue. The page guard is a redirect for the experience; the boundary is the
 * `enforce_membership_verification` trigger, and the action writes with the
 * session client so that trigger is what actually refuses a lesser role.
 */
export default async function AdminVerificationPage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/login?next=%2Fadmin%2Freal-estate%2Fverification");
  }
  if (!state.profile || !isKycReviewerRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const candidates = await loadVerifiedMembershipCandidates();

  const labels: Record<string, string> = {
    grant: t("adminVerification.grant"),
    revoke: t("adminVerification.revoke"),
    saving: t("adminVerification.saving"),
    saved: t("adminVerification.saved"),
    "errors.forbidden": t("errors.forbidden"),
    "errors.write_failed": t("errors.write_failed"),
    "errors.unauthenticated": t("errors.unauthenticated"),
    "errors.unconfigured": t("errors.unconfigured"),
    "errors.not_found": t("errors.not_found"),
  };

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("adminVerification.heading")}
        intro={t("adminVerification.intro")}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/admin/real-estate" variant="secondary">
          {t("realEstate.admin.heading")}
        </ButtonLink>
      </div>

      <div className="mt-6">
        <Notice tone="info" title={t("adminVerification.boundaryTitle")}>
          {t("adminVerification.boundaryBody")}
        </Notice>
      </div>

      <div className="mt-10">
        {candidates.length === 0 ? (
          <Notice tone="info" title={t("adminVerification.heading")}>
            {t("adminVerification.empty")}
          </Notice>
        ) : (
          <ul className="flex flex-col gap-6">
            {candidates.map((entry) => {
              const verified = isVerifiedMembership(entry);
              return (
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
                        {verified ? (
                          <Badge tone="success">
                            {t("adminVerification.verifiedBadge")}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <PublisherVerificationForm
                      membershipId={entry.id}
                      verified={verified}
                      labels={labels}
                    />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
