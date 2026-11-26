import { notFound, redirect } from "next/navigation";

import { KycReviewPanel } from "@/components/admin/KycReviewPanel";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { isKycReviewerRole } from "@/lib/auth/roles";
import { getAuthState } from "@/lib/auth/session";
import { createTranslator } from "@/lib/i18n/translator";
import {
  ageInYears,
  kycIdTypeLabelKey,
  kycResidencyStatusLabelKey,
  kycStatusLabelKey,
} from "@/lib/real-estate/kyc";
import {
  loadKycApplication,
  loadKycDocuments,
  loadKycHistory,
} from "@/lib/real-estate/kyc-loaders";

export const dynamic = "force-dynamic";

/**
 * Admin: one KYC application, and the decision.
 *
 * **Super-admin only**, like the queue. The detail read goes through the session
 * client, so `kyc_applications_select_super_admin` is the control; the guard turns
 * a refusal into the unauthorized page rather than an empty detail view.
 *
 * The listing's legal documents are shown alongside the identity evidence,
 * because the two answer different questions and a reviewer deciding "may this
 * person advertise property" benefits from both. They are loaded only when the
 * application has reached a decision-ready state.
 */
export default async function AdminKycDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect(
      `/login?next=${encodeURIComponent(`/admin/real-estate/kyc/${id}`)}`,
    );
  }
  if (!state.profile || !isKycReviewerRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const application = await loadKycApplication(id);
  if (!application) notFound();

  const documents = await loadKycDocuments(application.id);
  const history = await loadKycHistory(application.id);

  const capabilityLabel = t(
    `account.membership.typeLabel.${application.membershipType}`,
  );
  const age = ageInYears(application.dateOfBirth);

  return (
    <>
      <PageIntro
        eyebrow={t("adminKyc.detailHeading")}
        heading={application.fullLegalName}
        intro={t("adminKyc.intro")}
        back={{
          href: "/admin/real-estate/kyc",
          label: t("common.backTo", { destination: t("adminNav.kyc") }),
        }}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge tone="accent">{capabilityLabel}</Badge>
        <Badge tone="neutral">{t(kycStatusLabelKey(application.status))}</Badge>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/admin/real-estate/kyc" variant="secondary">
          {t("adminKyc.backToQueue")}
        </ButtonLink>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("adminKyc.personalSection")}
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <DetailRow
              label={t("adminKyc.fullLegalName")}
              value={application.fullLegalName}
            />
            <DetailRow
              label={t("adminKyc.email")}
              value={application.email}
              mono
            />
            <DetailRow
              label={t("adminKyc.phone")}
              value={application.phone}
              mono
            />
            <DetailRow
              label={t("adminKyc.countryOfResidence")}
              value={application.countryOfResidence}
            />
            <DetailRow
              label={t("adminKyc.currentLocation")}
              value={application.currentLocation ?? "—"}
            />
            <DetailRow
              label={t("adminKyc.residencyStatus")}
              value={t(kycResidencyStatusLabelKey(application.residencyStatus))}
            />
            <DetailRow
              label={t("adminKyc.dateOfBirth")}
              value={`${application.dateOfBirth} (${age})`}
            />
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("adminKyc.identitySection")}
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <DetailRow
              label={t("adminKyc.idType")}
              value={t(kycIdTypeLabelKey(application.idType))}
            />
            <DetailRow
              label={t("adminKyc.idIssuingCountry")}
              value={application.idIssuingCountry}
            />
            <DetailRow
              label={t("adminKyc.idNumberLast4")}
              value={application.idNumberLast4 ?? "—"}
              mono
            />
            <DetailRow
              label={t("adminKyc.consentGiven")}
              value={
                application.videoConsentAt
                  ? t("adminKyc.consentGiven")
                  : t("adminKyc.consentNotGiven")
              }
            />
            <DetailRow
              label={t("adminKyc.declarationGiven")}
              value={application.declarationAcceptedAt ? "✓" : "—"}
            />
          </dl>
        </Card>
      </div>

      <div className="mt-8">
        <KycReviewPanel
          applicationId={application.id}
          status={application.status}
          documents={documents}
          locale="en"
          canDecide
        />
      </div>

      <div className="mt-12">
        <Card>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("adminKyc.historySection")}
          </h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t("adminKyc.noHistory")}</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {history.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3 last:border-0"
                >
                  <span className="text-sm text-body">
                    {t(`account.kyc.history${historySuffix(event.action)}`)}
                    {event.note ? ` — ${event.note}` : ""}
                  </span>
                  <time
                    dateTime={event.createdAt}
                    className="font-mono text-xs text-muted"
                  >
                    {event.createdAt.slice(0, 19).replace("T", " ")}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "font-mono text-ink-900" : "text-ink-900"}>
        {value}
      </dd>
    </div>
  );
}

function historySuffix(action: string): string {
  switch (action) {
    case "submitted":
      return "Submitted";
    case "review_started":
      return "ReviewStarted";
    case "document_viewed":
      return "DocumentViewed";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "changes_requested":
      return "ChangesRequested";
    case "note_added":
      return "NoteAdded";
    default:
      return "Submitted";
  }
}
