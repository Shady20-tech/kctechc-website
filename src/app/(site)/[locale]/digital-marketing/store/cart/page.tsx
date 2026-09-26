import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { CartLines } from "@/components/store/CartLines";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { STORE_PATH } from "@/lib/config/navigation";
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
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: `${STORE_PATH}/cart`,
    title: t("store.cart.heading"),
    description: t("store.cart.intro"),
    // A cart is per-visitor and must never be indexed.
    noindex: true,
  });
}

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const cart = await getCurrentCart();

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.store"), href: `/${resolved}${STORE_PATH}` },
    { name: t("store.cart.heading"), href: `/${resolved}${STORE_PATH}/cart` },
  ];

  return (
    <SectionBand
      labelledBy="cart-heading"
      {...departmentScopeProps("digital-marketing")}
    >
      <Breadcrumbs
        items={breadcrumbs}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />
      <PageIntro
        heading={t("store.cart.heading")}
        intro={t("store.cart.intro")}
      />
      <h2 id="cart-heading" className="visually-hidden">
        {t("store.cart.heading")}
      </h2>

      {!cart || cart.lines.length === 0 ? (
        <div className="mt-10 max-w-2xl">
          <h3 className="text-xl font-semibold text-ink-900">
            {t("store.cart.emptyHeading")}
          </h3>
          <p className="mt-3 text-base text-body">
            {t("store.cart.emptyBody")}
          </p>
          <p className="mt-6">
            <ButtonLink href={`/${resolved}${STORE_PATH}`} variant="secondary">
              {t("store.cart.continueShopping")}
            </ButtonLink>
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CartLines cart={cart} locale={resolved} t={t} />
          </div>

          <aside
            aria-labelledby="cart-summary-heading"
            className="lg:col-span-1"
          >
            <div className="rounded-card border border-border bg-surface-alt p-6">
              <h3
                id="cart-summary-heading"
                className="text-base font-semibold text-ink-900"
              >
                {t("store.cart.subtotalLabel")}
              </h3>
              <p className="mt-3 font-display text-2xl font-bold text-ink-900">
                {formatPrice(cart.subtotalMinor, cart.currency, resolved)}
              </p>
              <p className="mt-4 text-sm text-body">
                {t("store.cart.checkoutUnavailable")}
              </p>
            </div>
          </aside>
        </div>
      )}
    </SectionBand>
  );
}
