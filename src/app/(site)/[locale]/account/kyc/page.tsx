import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import { KycApplicationForm } from "@/components/account/KycApplicationForm";
import { SectionBand } from "@/components/layout/PageShell";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { type KycMembershipType } from "@/lib/real-estate/kyc";
import {
  loadMyKycApplication,
  loadMyKycDocuments,
  loadMyKycHistory,
} from "@/lib/real-estate/kyc-loaders";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The applicant's KYC application, for one capability.
 *
 * Reached from the account hub. The capability is chosen by the `?for=` search
 * parameter, constrained to the two members of `kyc_membership_type`; an unknown
 * value falls back to the applicant's declared account type, and a buyer (who has
 * no capability to verify) is shown the "nothing to do here" state rather than an
 * empty form.
 *
 * Everything on this page is read through the session client, so RLS is the
 * control: the applicant sees their own application and nothing else. The guard
 * exists so a signed-out visitor is sent to sign in with this page as the return
 * target, not because it is the boundary.
 *
 * `noindex`: the page is per-customer and carries a private workflow.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;

  return buildMetadata({
    locale,
    pathWithoutLocale: "/account/kyc",
    title: t("account.kyc.heading"),
    description: t("account.kyc.intro"),
    noindex: true,
  });
}

/** Resolve the requested capability, falling back to the declared account type. */
function resolveMembershipType(
  requested: string | undefined,
  declared: string | null,
): KycMembershipType | null {
  if (requested === "landlord" || requested === "agent") return requested;
  if (declared === "landlord" || declared === "agent") return declared;
  if (declared === "buyer") return null;
  return "landlord";
}

export default async function KycPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ for?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const returnTo = encodeURIComponent(`/${resolved}/account/kyc`);

  const state = await getAuthState();
  if (state.status === "unconfigured") {
    redirect(`/login?reason=unconfigured&next=${returnTo}`);
  }
  if (state.status !== "authenticated") {
    redirect(`/login?next=${returnTo}`);
  }

  const { for: requestedFor } = await searchParams;
  const membershipType = resolveMembershipType(
    requestedFor,
    state.profile?.declaredAccountType ?? null,
  );

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("account.heading"), href: `/${resolved}/account` },
    { name: t("account.kyc.heading"), href: `/${resolved}/account/kyc` },
  ];

  if (membershipType === null) {
    return (
      <SectionBand labelledBy="kyc-heading">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-8"
        />
        <PageIntro
          eyebrow={t("account.eyebrow")}
          heading={t("account.kyc.heading")}
          intro={t("account.kyc.intro")}
          back={{
            href: `/${resolved}/account`,
            label: t("common.backTo", { destination: t("account.heading") }),
          }}
        />
        <div className="mt-10">
          <Notice tone="info">{t("account.kyc.buyerNote")}</Notice>
        </div>
        <div className="mt-6">
          <ButtonLink href={`/${resolved}/account`} variant="secondary">
            {t("account.heading")}
          </ButtonLink>
        </div>
      </SectionBand>
    );
  }

  const application = await loadMyKycApplication(membershipType);
  const documents = application ? await loadMyKycDocuments(application.id) : [];
  const history = application ? await loadMyKycHistory(application.id) : [];

  const capabilityLabel = t(`account.membership.typeLabel.${membershipType}`);

  return (
    <SectionBand labelledBy="kyc-heading">
      <Breadcrumbs
        items={breadcrumbs}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />
      <PageIntro
        eyebrow={capabilityLabel}
        heading={t("account.kyc.heading")}
        intro={t("account.kyc.intro")}
        back={{
          href: `/${resolved}/account`,
          label: t("common.backTo", { destination: t("account.heading") }),
        }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <p className="text-sm text-muted">
          {t("auth.signedInAs", { email: state.email ?? "" })}
        </p>
        <CustomerSignOutForm locale={resolved} label={t("actions.signOut")} />
      </div>

      <h2 id="kyc-heading" className="visually-hidden">
        {t("account.kyc.heading")}
      </h2>

      <div className="mt-10">
        <KycApplicationForm
          membershipType={membershipType}
          application={application}
          documents={documents}
          locale={resolved}
        />
      </div>

      {history.length > 0 ? (
        <Card className="mt-12">
          <h3 className="text-lg font-semibold text-ink-900">
            {t("account.kyc.historyHeading")}
          </h3>
          <ol className="mt-4 space-y-3">
            {history.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3 last:border-0"
              >
                <span className="text-sm text-body">
                  {t(`account.kyc.history${historyLabelSuffix(event.action)}`)}
                  {event.note ? ` — ${event.note}` : ""}
                </span>
                <time
                  dateTime={event.createdAt}
                  className="font-mono text-xs text-muted"
                >
                  {event.createdAt.slice(0, 10)}
                </time>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <div className="mt-10">
        <ButtonLink href={`/${resolved}/account`} variant="secondary">
          {t("account.heading")}
        </ButtonLink>
      </div>
    </SectionBand>
  );
}

/** Map a review action to its camel-case history label suffix. */
function historyLabelSuffix(action: string): string {
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
