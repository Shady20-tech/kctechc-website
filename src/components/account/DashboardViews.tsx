import type { ReactNode } from "react";

import {
  CapabilityGatePanel,
  DashboardListingCard,
} from "@/components/account/DashboardPanels";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionBand } from "@/components/layout/PageShell";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { DashboardKind } from "@/lib/real-estate/dashboard";
import { summariseListings } from "@/lib/real-estate/dashboard";
import type { DashboardContext } from "@/lib/real-estate/dashboard-loaders";

/**
 * The shared body of a dashboard's overview page.
 *
 * A Server Component parameterised by `kind`, so the landlord and agent routes
 * are three lines each and cannot drift into two different page structures. The
 * parts that genuinely differ — the agent's public profile panel — arrive as a
 * `footer` slot rather than as a second component.
 *
 * When the capability is not approved the page renders the verification panel
 * instead of the listings: the listings would be empty (the policies return
 * nothing) and showing "you have no listings yet" beside an unapproved
 * application would read as a dead end rather than as a wait.
 */
export function DashboardOverview({
  context,
  locale,
  footer,
}: {
  context: DashboardContext;
  locale: Locale;
  footer?: ReactNode;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${context.kind}`;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${locale}` },
    { name: t("account.heading"), href: `/${locale}/account` },
    { name: t(`${base}.title`), href: `/${locale}/account/${context.kind}` },
  ];

  const overview = summariseListings(context.listings);

  return (
    <SectionBand labelledBy="dashboard-heading">
      <Breadcrumbs
        items={breadcrumbs}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />

      <PageIntro
        eyebrow={t("account.eyebrow")}
        heading={t(`${base}.title`)}
        intro={t(`${base}.intro`)}
      />

      <h2 id="dashboard-heading" className="visually-hidden">
        {t(`${base}.title`)}
      </h2>

      {!context.authorised ? (
        <div className="mt-10">
          <CapabilityGatePanel summary={context.membership} locale={locale} />
        </div>
      ) : (
        <>
          <section className="mt-10" aria-labelledby="overview-heading">
            <h3
              id="overview-heading"
              className="font-mono text-xs uppercase tracking-widest text-muted"
            >
              {t(`${base}.overviewHeading`)}
            </h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {(
                [
                  ["overviewTotal", overview.total],
                  ["overviewDrafts", overview.drafts],
                  ["overviewPendingReview", overview.pendingReview],
                  ["overviewPublished", overview.published],
                  ["overviewClosed", overview.closed],
                ] as const
              ).map(([key, value]) => (
                <Card key={key} className="flex flex-col">
                  <dt className="text-xs text-muted">{t(`${base}.${key}`)}</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-ink-900">
                    {value}
                  </dd>
                </Card>
              ))}
            </dl>
          </section>

          <section className="mt-12" aria-labelledby="listings-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3
                  id="listings-heading"
                  className="text-xl font-semibold text-ink-900"
                >
                  {t(`${base}.listingsHeading`)}
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-body">
                  {t(`${base}.listingsIntro`)}
                </p>
              </div>
              <ButtonLink
                href={`/${locale}/account/${context.kind}/new`}
                variant="primary"
              >
                {t(`${base}.createCta`)}
              </ButtonLink>
            </div>

            {context.listings.length === 0 ? (
              <div className="mt-6">
                <Notice tone="info">{t(`${base}.noListings`)}</Notice>
              </div>
            ) : (
              <ul className="mt-6 grid gap-6 lg:grid-cols-2">
                {context.listings.map((listing) => (
                  <DashboardListingCard
                    key={listing.id}
                    listing={listing}
                    locale={locale}
                    kind={context.kind}
                  />
                ))}
              </ul>
            )}
          </section>

          {footer}
        </>
      )}
    </SectionBand>
  );
}

/**
 * The "create a listing" page body.
 *
 * The geography options are loaded by the route and passed in whole, matching the
 * console: the region list is small, and loading it in the browser would be a
 * second request the form waits on. When there is no geography the form cannot be
 * completed at all, so the page says so rather than rendering a region select with
 * no options.
 */
export function DashboardCreateBody({
  kind,
  locale,
  form,
  hasGeography,
}: {
  kind: DashboardKind;
  locale: Locale;
  form: ReactNode;
  hasGeography: boolean;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${kind}`;

  return (
    <SectionBand labelledBy="create-heading">
      <Breadcrumbs
        items={[
          { name: t("nav.home"), href: `/${locale}` },
          { name: t("account.heading"), href: `/${locale}/account` },
          {
            name: t(`${base}.title`),
            href: `/${locale}/account/${kind}`,
          },
          {
            name: t(`${base}.createHeading`),
            href: `/${locale}/account/${kind}/new`,
          },
        ]}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />

      <PageIntro
        eyebrow={t("account.eyebrow")}
        heading={t(`${base}.createHeading`)}
        intro={t(`${base}.createIntroLong`)}
        back={{
          href: `/${locale}/account/${kind}`,
          label: t("common.backTo", { destination: t(`${base}.title`) }),
        }}
      />

      <h2 id="create-heading" className="visually-hidden">
        {t(`${base}.createHeading`)}
      </h2>

      <div className="mt-8">
        {hasGeography ? (
          form
        ) : (
          <Notice tone="warning" title={t(`${base}.createHeading`)}>
            <p>{t("errors.unconfigured")}</p>
          </Notice>
        )}
      </div>
    </SectionBand>
  );
}

/** The "edit a listing" page body. */
export function DashboardDetailBody({
  kind,
  locale,
  children,
}: {
  kind: DashboardKind;
  locale: Locale;
  children: ReactNode;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${kind}`;

  return (
    <SectionBand labelledBy="detail-heading">
      <Breadcrumbs
        items={[
          { name: t("nav.home"), href: `/${locale}` },
          { name: t("account.heading"), href: `/${locale}/account` },
          {
            name: t(`${base}.title`),
            href: `/${locale}/account/${kind}`,
          },
          {
            name: t(`${base}.editHeading`),
            href: `/${locale}/account/${kind}`,
          },
        ]}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />

      <PageIntro
        eyebrow={t("account.eyebrow")}
        heading={t(`${base}.editHeading`)}
        intro={t(`${base}.editIntro`)}
        back={{
          href: `/${locale}/account/${kind}`,
          label: t("common.backTo", { destination: t(`${base}.title`) }),
        }}
      />

      <h2 id="detail-heading" className="visually-hidden">
        {t(`${base}.editHeading`)}
      </h2>

      <div className="mt-8 space-y-10">{children}</div>

      <p className="mt-10">
        <ButtonLink
          href={`/${locale}/account/${kind}`}
          variant="secondary"
          size="sm"
        >
          {t(`${base}.backToListings`)}
        </ButtonLink>
      </p>
    </SectionBand>
  );
}
