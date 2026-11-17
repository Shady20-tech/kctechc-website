import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import { MembershipCard } from "@/components/account/MembershipCard";
import { ProfileResidencyForm } from "@/components/account/ProfileResidencyForm";
import { SectionBand } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { STORE_PATH, storePathFor } from "@/lib/config/navigation";
import { getAuthState } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  listOrdersForCustomer,
  resolveOrderDepartments,
} from "@/lib/orders/queries";
import { loadSavedSearches } from "@/lib/real-estate/loaders";
import { accessibleDashboards } from "@/lib/real-estate/dashboard";
import {
  loadCameroonRegions,
  loadMyMembershipSummary,
} from "@/lib/real-estate/membership-loaders";
import { buildMetadata } from "@/lib/seo/metadata";
import { formatPrice } from "@/lib/store/types";

/**
 * The signed-in account hub.
 *
 * This is where a customer lands after signing in, and the one page that answers
 * "where is everything I did on this site". The site already had per-customer
 * surfaces — order history, favourites, saved searches — but each lived inside a
 * department, and the public header's only account action was "Sign in", which
 * pointed at the admin console.
 *
 * Each entry is a *link* to the owning surface rather than a second
 * implementation of it, so the department pages stay the place a customer acts on
 * their data and this page cannot drift from them. The counts come from loaders
 * that already return empty on any failure, so an outage degrades to "0" rather
 * than an error page.
 *
 * `force-dynamic` because the page reads the session cookie; prerendering it would
 * bake in the signed-out redirect and serve it to everyone.
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
    pathWithoutLocale: "/account",
    title: t("account.metaTitle"),
    description: t("account.metaDescription"),
    noindex: true,
  });
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const returnTo = encodeURIComponent(`/${resolved}/account`);

  const state = await getAuthState();
  if (state.status === "unconfigured") {
    redirect(`/admin/login?reason=unconfigured&next=${returnTo}`);
  }
  if (state.status !== "authenticated") {
    redirect(`/admin/login?next=${returnTo}`);
  }

  const orders = await listOrdersForCustomer(state.userId);
  const orderDepartments = await resolveOrderDepartments(
    orders.map((o) => o.id),
  );
  const savedSearches = await loadSavedSearches();
  const memberships = await loadMyMembershipSummary();
  const regions = await loadCameroonRegions(resolved);

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("account.heading"), href: `/${resolved}/account` },
  ];

  // Labels are collected into a plain object because the two forms below are
  // Client Components: a translator function cannot cross that boundary (the RSC
  // serializer refuses it), so each client island receives strings.
  const membershipLabels: Record<string, string> = {
    "account.membership.typeLabel.landlord": t(
      "account.membership.typeLabel.landlord",
    ),
    "account.membership.typeLabel.agent": t(
      "account.membership.typeLabel.agent",
    ),
    "account.membership.typeBody.landlord": t(
      "account.membership.typeBody.landlord",
    ),
    "account.membership.typeBody.agent": t("account.membership.typeBody.agent"),
    "account.membership.status.pending_kyc": t(
      "account.membership.status.pending_kyc",
    ),
    "account.membership.status.pending_review": t(
      "account.membership.status.pending_review",
    ),
    "account.membership.status.approved": t(
      "account.membership.status.approved",
    ),
    "account.membership.status.rejected": t(
      "account.membership.status.rejected",
    ),
    "account.membership.status.changes_requested": t(
      "account.membership.status.changes_requested",
    ),
    "account.membership.status.suspended": t(
      "account.membership.status.suspended",
    ),
    activeBadge: t("account.membership.activeBadge"),
    activeHint: t("account.membership.activeHint"),
    pendingHint: t("account.membership.pendingHint"),
    suspendedHint: t("account.membership.suspendedHint"),
    reviewerNote: t("account.membership.reviewerNote"),
    suspendedReason: t("account.membership.suspendedReason"),
    kycLabel: t("account.membership.kycLabel"),
    kycHint: t("account.membership.kycHint"),
    notesLabel: t("account.membership.notesLabel"),
    apply: t("account.membership.apply"),
    applying: t("account.membership.applying"),
    applicationReceived: t("account.membership.applicationReceived"),
    "errors.write_failed": t("errors.write_failed"),
    "errors.unauthenticated": t("errors.unauthenticated"),
    "errors.unconfigured": t("errors.unconfigured"),
    "errors.rate_limited": t("errors.rate_limited"),
    "errors.already_member": t("errors.already_member"),
    "errors.invalid_type": t("errors.invalid_type"),
    "errors.invalid": t("errors.invalid"),
  };

  const residencyLabels: Record<string, string> = {
    residencyHeading: t("account.residencyHeading"),
    residencyIntro: t("account.residencyIntro"),
    nameLabel: t("account.nameLabel"),
    phoneLabel: t("account.phoneLabel"),
    phoneHint: t("account.phoneHint"),
    countryLabel: t("account.countryLabel"),
    countryCodeLabel: t("account.countryCodeLabel"),
    countryCodeHint: t("account.countryCodeHint"),
    cityLabel: t("account.cityLabel"),
    regionLabel: t("account.regionLabel"),
    regionHint: t("account.regionHint"),
    regionPlaceholder: t("account.regionPlaceholder"),
    permanentResidencyLabel: t("account.permanentResidencyLabel"),
    save: t("account.save"),
    saving: t("account.saving"),
    updated: t("account.updated"),
    "errors.required": t("errors.required"),
    "errors.tooLong": t("errors.tooLong"),
    "errors.tooShort": t("errors.tooShort"),
    "errors.invalidPhone": t("errors.invalidPhone"),
    "errors.invalidCountryCode": t("errors.invalidCountryCode"),
    "errors.invalid": t("errors.invalid"),
    "errors.write_failed": t("errors.write_failed"),
    "errors.unauthenticated": t("errors.unauthenticated"),
    "errors.unconfigured": t("errors.unconfigured"),
  };

  // The KYC tile is offered only to an account that declared a capability — a
  // landlord or an agent. A buyer has nothing to verify, so the tile would be a
  // link to a page that tells them so.
  const declared = state.profile?.declaredAccountType ?? null;
  const kycCapability =
    declared === "landlord" || declared === "agent" ? declared : null;

  // A dashboard is offered only for a capability that is actually approved.
  // `accessibleDashboards` is the same predicate the dashboard routes guard with,
  // so a link rendered here always resolves to a page that renders. An
  // application that is pending or sent back is *not* linked from here: the
  // capability card below already shows its status and the action to take, and a
  // second entry point would be a link into a "waiting" panel.
  const dashboards = accessibleDashboards(memberships);

  const tiles = [
    {
      key: "orders",
      href: `/${resolved}${STORE_PATH}/orders`,
      count: orders.length,
      title: t("account.ordersTitle"),
      body: t("account.ordersBody"),
      cta: t("account.ordersCta"),
    },
    ...dashboards.map((kind) => ({
      key: `${kind}Dashboard`,
      href: `/${resolved}/account/${kind}`,
      title: t(`account.dashboards.${kind}.accountTileTitle`),
      body: t(`account.dashboards.${kind}.accountTileBody`),
      cta: t(`account.dashboards.${kind}.accountTileCta`),
    })),
    {
      key: "favorites",
      href: `/${resolved}/real-estate/favorites`,
      title: t("account.favoritesTitle"),
      body: t("account.favoritesBody"),
      cta: t("account.favoritesCta"),
    },
    {
      key: "savedSearches",
      href: `/${resolved}/real-estate/saved-searches`,
      count: savedSearches.length,
      title: t("account.savedSearchesTitle"),
      body: t("account.savedSearchesBody"),
      cta: t("account.savedSearchesCta"),
    },
    ...(kycCapability
      ? [
          {
            key: "kyc",
            href: `/${resolved}/account/kyc?for=${kycCapability}`,
            title: t("account.kyc.heading"),
            body: t("account.kyc.intro"),
            cta: t("account.kyc.continueCta"),
          },
        ]
      : []),
  ];

  return (
    <SectionBand labelledBy="account-heading">
      <Breadcrumbs
        items={breadcrumbs}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />
      <PageIntro
        eyebrow={t("account.eyebrow")}
        heading={t("account.heading")}
        intro={t("account.intro")}
      />
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <p className="text-sm text-muted">
          {t("auth.signedInAs", { email: state.email ?? "" })}
        </p>
        <CustomerSignOutForm locale={resolved} label={t("actions.signOut")} />
      </div>

      <h2 id="account-heading" className="visually-hidden">
        {t("account.heading")}
      </h2>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.key} className="flex flex-col">
            <h3 className="text-lg font-semibold text-ink-900">{tile.title}</h3>
            {"count" in tile ? (
              <p className="mt-2 font-mono text-sm text-muted">{tile.count}</p>
            ) : null}
            <p className="mt-2 flex-1 text-sm text-body">{tile.body}</p>
            <p className="mt-4">
              <ButtonLink href={tile.href} variant="secondary" size="sm">
                {tile.cta}
              </ButtonLink>
            </p>
          </Card>
        ))}
      </div>

      <section className="mt-12" aria-labelledby="account-capabilities-heading">
        <h2
          id="account-capabilities-heading"
          className="text-xl font-semibold text-ink-900"
        >
          {t("account.membership.heading")}
        </h2>
        <p className="mt-2 max-w-2xl text-base text-body">
          {t("account.membership.intro")}
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {memberships.map((summary) => (
            <MembershipCard
              key={summary.type}
              summary={summary}
              labels={membershipLabels}
            />
          ))}
        </div>
      </section>

      {state.profile ? (
        <div className="mt-12">
          <ProfileResidencyForm
            profile={{
              fullName: state.profile.fullName,
              phone: state.profile.phone,
              countryOfResidence: state.profile.countryOfResidence,
              countryIsoCode: state.profile.countryIsoCode,
              city: state.profile.city,
              regionId: state.profile.regionId,
              permanentResidency: state.profile.permanentResidency,
            }}
            regions={regions}
            labels={residencyLabels}
          />
        </div>
      ) : null}

      <section className="mt-12" aria-labelledby="account-orders-heading">
        <h2
          id="account-orders-heading"
          className="text-xl font-semibold text-ink-900"
        >
          {t("account.recentOrdersHeading")}
        </h2>
        {orders.length === 0 ? (
          <p className="mt-4 max-w-2xl text-base text-body">
            {t("order.historyEmpty")}
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {orders.slice(0, 5).map((order) => {
              const department = orderDepartments.get(order.id);
              const href = department
                ? `/${resolved}${storePathFor(department)}/orders/${encodeURIComponent(order.reference)}`
                : `/${resolved}${STORE_PATH}/orders`;
              return (
                <li key={order.id}>
                  <Link
                    href={href}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:border-dept-accent"
                  >
                    <span className="font-mono text-sm text-ink-900">
                      {order.reference}
                    </span>
                    <Badge tone="neutral">
                      {t(`orderStatus.${order.status}`)}
                    </Badge>
                    <span className="text-sm text-body">
                      {formatPrice(order.totalMinor, order.currency, resolved)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </SectionBand>
  );
}
