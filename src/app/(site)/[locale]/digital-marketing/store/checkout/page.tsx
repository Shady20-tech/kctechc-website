import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { STORE_PATH } from "@/lib/config/navigation";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCart } from "@/lib/store/cart";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Checkout page.
 *
 * The cart is resolved on the server from the token cookie, so the line items and
 * amounts handed to the form are the recorded ones rather than anything the
 * browser could have supplied. The form itself posts no prices — every total is
 * recomputed in `place_order` from the catalogue.
 *
 * `force-dynamic` because the content depends on a cookie: a cached checkout page
 * would show one visitor another visitor's basket.
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
    pathWithoutLocale: `${STORE_PATH}/checkout`,
    title: t("checkout.metaTitle"),
    description: t("checkout.metaDescription"),
    // A checkout is per-visitor and must never be indexed.
    noindex: true,
  });
}

export default async function CheckoutPage({
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
    {
      name: t("store.cart.heading"),
      href: `/${resolved}${STORE_PATH}/cart`,
    },
    {
      name: t("checkout.heading"),
      href: `/${resolved}${STORE_PATH}/checkout`,
    },
  ];

  return (
    <SectionBand
      labelledBy="checkout-heading"
      {...departmentScopeProps("digital-marketing")}
    >
      <Breadcrumbs
        items={breadcrumbs}
        ariaLabel={t("a11y.breadcrumb")}
        className="mb-8"
      />
      <PageIntro heading={t("checkout.heading")} intro={t("checkout.intro")} />
      <h2 id="checkout-heading" className="visually-hidden">
        {t("checkout.heading")}
      </h2>

      {!cart || cart.lines.length === 0 ? (
        <div className="mt-10 max-w-2xl">
          <h3 className="text-xl font-semibold text-ink-900">
            {t("checkout.emptyHeading")}
          </h3>
          <p className="mt-3 text-base text-body">{t("checkout.emptyBody")}</p>
          <p className="mt-6">
            <ButtonLink href={`/${resolved}${STORE_PATH}`} variant="secondary">
              {t("checkout.emptyCta")}
            </ButtonLink>
          </p>
        </div>
      ) : (
        <div className="mt-10 max-w-3xl">
          <CheckoutForm
            locale={resolved}
            currency={cart.currency}
            subtotalMinor={cart.lines.reduce(
              // The price that will be charged is the catalogue price, not the
              // one recorded when the item was added. Displaying the recorded
              // price would show the customer an amount different from what
              // `place_order` computes, which is the worst possible surprise at
              // checkout. `currentPriceMinor` is that catalogue price.
              (total, line) =>
                total + (line.currentPriceMinor ?? line.unitPriceMinor) * line.quantity,
              0,
            )}
            items={cart.lines.map((line) => ({
              id: line.id,
              productId: line.productId,
              title: line.title,
              slug: line.slug,
              quantity: line.quantity,
              unitPriceMinor: line.currentPriceMinor ?? line.unitPriceMinor,
            }))}
          />
        </div>
      )}
    </SectionBand>
  );
}
