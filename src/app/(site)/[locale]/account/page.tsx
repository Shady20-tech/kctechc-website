import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
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
  const orderDepartments = await resolveOrderDepartments(orders.map((o) => o.id));
  const savedSearches = await loadSavedSearches();

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("account.heading"), href: `/${resolved}/account` },
  ];

  const tiles = [
    {
      key: "orders",
      href: `/${resolved}${STORE_PATH}/orders`,
      count: orders.length,
      title: t("account.ordersTitle"),
      body: t("account.ordersBody"),
      cta: t("account.ordersCta"),
    },
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
  ] as const;

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
