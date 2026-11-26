import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { SectionBand } from "@/components/layout/PageShell";
import { CartLines } from "@/components/store/CartLines";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { storePathFor } from "@/lib/config/navigation";
import { DEPARTMENTS } from "@/lib/config/site";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCart } from "@/lib/store/cart";
import { formatPrice } from "@/lib/store/types";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Cart page.
 *
 * The cart is read on the server from the database through the token cookie, so
 * the rendered prices are the ones recorded when each item was added — not values
 * that travelled through the browser. `force-dynamic` is required because the
 * content depends on a cookie, and a cached cart would show one visitor another
 * visitor's items.
 *
 * The page renders an honest empty state when there is no cart, and checkout is
 * explicitly not offered: no payment provider is configured in this phase, so
 * presenting a checkout button would be a promise the platform cannot keep.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}): Promise<Metadata> {
  const { locale, department } = await params;
  if (!isLocale(locale)) return {};
  if (!DEPARTMENTS.some((entry) => entry.slug === department)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: `${storePathFor(department)}/cart`,
    title: t("store.cart.heading"),
    description: t("store.cart.intro"),
    // A cart is per-visitor and must never be indexed.
    noindex: true,
  });
}

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}) {
  const { locale, department } = await params;
  if (!isLocale(locale)) notFound();
  if (!DEPARTMENTS.some((entry) => entry.slug === department)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const storePath = storePathFor(department);
  const cart = await getCurrentCart();

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.store"), href: `/${resolved}${storePath}` },
    { name: t("store.cart.heading"), href: `/${resolved}${storePath}/cart` },
  ];

  return (
    <SectionBand
      labelledBy="cart-heading"
      {...departmentScopeProps(
        department as (typeof DEPARTMENTS)[number]["slug"],
      )}
    >
      <Breadcrumbs
        items={breadcrumbs}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />
      <PageIntro
        heading={t("store.cart.heading")}
        intro={t("store.cart.intro")}
        back={{
          href: `/${resolved}${storePath}`,
          label: t("store.backToStore"),
        }}
      />
      <h2 id="cart-heading" className="visually-hidden">
        {t("store.cart.heading")}
      </h2>

      {!cart || cart.lines.length === 0 ? (
        <div className="mt-10 rounded-panel border border-border bg-surface p-8 text-center shadow-card sm:p-14">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-surface-sunken text-muted">
            <ShoppingBag aria-hidden="true" className="h-6 w-6" />
          </span>
          <h3 className="mt-5 text-xl font-semibold text-ink-900">
            {t("store.cart.emptyHeading")}
          </h3>
          <p className="mx-auto mt-3 max-w-md text-base text-body">
            {t("store.cart.emptyBody")}
          </p>
          <p className="mt-7">
            <ButtonLink href={`/${resolved}${storePath}`} variant="primary">
              {t("store.cart.continueShopping")}
            </ButtonLink>
          </p>
          <div className="mx-auto mt-10 max-w-md border-t border-border pt-6 text-left">
            <h4 className="text-sm font-semibold text-ink-900">
              {t("store.cart.browseHeading")}
            </h4>
            <p className="mt-1 text-sm text-body">
              {t("store.cart.browseBody")}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
          <div className="min-w-0">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-ink-900">
                {t("store.cart.itemsLabel")}
              </h2>
              <p className="text-sm text-muted">
                {cart.itemCount === 1
                  ? t("store.cart.itemCountOne")
                  : t("store.cart.itemCount", { count: cart.itemCount })}
              </p>
            </div>
            <CartLines cart={cart} locale={resolved} />
          </div>

          <aside
            aria-labelledby="cart-summary-heading"
            className="min-w-0 lg:sticky lg:top-24"
          >
            <div className="rounded-panel border border-border bg-surface p-6 shadow-card">
              <h2
                id="cart-summary-heading"
                className="text-base font-semibold text-ink-900"
              >
                {t("store.cart.summaryHeading")}
              </h2>

              <dl className="mt-5 space-y-3 border-b border-border pb-5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-body">{t("store.cart.itemsLabel")}</dt>
                  <dd className="font-medium text-ink-900">
                    {cart.itemCount === 1
                      ? t("store.cart.itemCountOne")
                      : t("store.cart.itemCount", { count: cart.itemCount })}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-body">{t("store.cart.subtotalLabel")}</dt>
                  <dd className="font-medium text-ink-900">
                    {formatPrice(cart.subtotalMinor, cart.currency, resolved)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex items-baseline justify-between gap-3">
                <p className="text-base font-semibold text-ink-900">
                  {t("store.cart.subtotalLabel")}
                </p>
                <p className="font-display text-2xl font-bold text-ink-900">
                  {formatPrice(cart.subtotalMinor, cart.currency, resolved)}
                </p>
              </div>

              <p className="mt-6">
                <ButtonLink
                  href={`/${resolved}${storePath}/checkout`}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  {t("store.cart.checkout")}
                </ButtonLink>
              </p>

              <ul className="mt-6 space-y-3 border-t border-border pt-5 text-sm text-body">
                <li className="flex gap-2.5">
                  <Truck
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-dept-accent"
                  />
                  <span>{t("store.cart.deliveryNote")}</span>
                </li>
                <li className="flex gap-2.5">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-dept-accent"
                  />
                  <span>{t("store.cart.secureNote")}</span>
                </li>
              </ul>

              <p className="mt-5 text-xs leading-relaxed text-muted">
                {t("store.cart.totalNote")}
              </p>
            </div>
          </aside>
        </div>
      )}
    </SectionBand>
  );
}
