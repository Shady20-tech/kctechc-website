import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import { SectionBand } from "@/components/layout/PageShell";
import { OrderPurchaseTracker } from "@/components/checkout/OrderPurchaseTracker";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { STORE_PATH } from "@/lib/config/navigation";
import { getAuthState } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { getOrderForOwner } from "@/lib/orders/queries";
import { guestTokenFor } from "@/lib/orders/tokens";
import {
  isPaidStatus,
  shouldTrackPurchase,
  type OrderStatus,
} from "@/lib/orders/types";
import { formatPrice } from "@/lib/store/types";
import { productPath } from "@/lib/store/product-path";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Order confirmation and status page.
 *
 * Authorization is the point of this page. The order reference is not a
 * credential — it is short, enumerable and printed on receipts — so access needs
 * either a matching signed-in `customer_id` or the 64-character `access_token`
 * that only the placing browser holds in its cookie. A wrong guess renders the
 * not-found state, which is identical to a nonexistent reference, so the page
 * cannot be used to discover which references exist.
 *
 * The `?payment=` query flag set by the return route is *not* used for state. The
 * status shown is the one in the database, so a hand-edited URL cannot make an
 * unpaid order look paid.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}): Promise<Metadata> {
  const { locale, reference } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: `${STORE_PATH}/orders/${reference}`,
    title: t("order.metaTitle", { reference }),
    description: t("order.metaDescription"),
    noindex: true,
  });
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const authState = await getAuthState();
  const customerId = authState.status === "authenticated" ? authState.userId : null;
  const accessToken = customerId ? null : await guestTokenFor(reference);

  const order = await getOrderForOwner({ reference, customerId, accessToken });
  if (!order) notFound();

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.store"), href: `/${resolved}${STORE_PATH}` },
    { name: t("order.historyHeading"), href: `/${resolved}${STORE_PATH}/orders` },
    {
      name: order.reference,
      href: `/${resolved}${STORE_PATH}/orders/${encodeURIComponent(order.reference)}`,
    },
  ];

  const statusLabel = t(`orderStatus.${order.status}`);
  const paid = isPaidStatus(order.status);

  return (
    <SectionBand
      labelledBy="order-heading"
      {...departmentScopeProps("digital-marketing")}
    >
      <Breadcrumbs items={breadcrumbs} ariaLabel={t("a11y.breadcrumb")} className="mb-8" />
      <PageIntro
        heading={paid ? t("order.confirmationHeading") : t("order.statusHeading")}
        intro={paid ? t("order.thanking") : undefined}
      />
      {customerId ? (
        <div className="mt-4">
          <CustomerSignOutForm locale={resolved} label={t("actions.signOut")} />
        </div>
      ) : null}
      <h2 id="order-heading" className="visually-hidden">
        {t("order.statusHeading")}
      </h2>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* The purchase event fires only from a paid state, and is keyed on the
              order reference so reloading the page does not double-count. */}
          {shouldTrackPurchase(order.status) ? (
            <OrderPurchaseTracker
              orderReference={order.reference}
              totalMinor={order.totalMinor}
              currency={order.currency}
              items={order.lines.map((line) => ({
                productId: line.productId ?? line.id,
                title: line.title,
                unitPriceMinor: line.unitPriceMinor,
                quantity: line.quantity,
              }))}
            />
          ) : null}

          {renderStatusNotice({ status: order.status, t })}

          <section aria-labelledby="order-items-heading">
            <h3 id="order-items-heading" className="text-lg font-semibold text-ink-900">
              {t("order.itemsHeading")}
            </h3>
            <table className="mt-3 w-full text-sm">
              <caption className="visually-hidden">{t("order.itemsHeading")}</caption>
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col">{t("checkout.summaryItem")}</th>
                  <th scope="col" className="text-right">
                    {t("checkout.summaryQuantity")}
                  </th>
                  <th scope="col" className="text-right">
                    {t("checkout.summaryAmount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id} className="border-t border-border-strong">
                    <td className="py-2 pr-2">
                      <ButtonLink
                        href={productPath(resolved, line)}
                        variant="ghost"
                        size="sm"
                      >
                        {line.title}
                      </ButtonLink>
                    </td>
                    <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatPrice(line.lineTotalMinor, order.currency, resolved)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className="mt-4 space-y-1 border-t border-border-strong pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t("order.subtotal")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.subtotalMinor, order.currency, resolved)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("order.delivery")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.deliveryMinor, order.currency, resolved)}
                </dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>{t("order.total")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.totalMinor, order.currency, resolved)}
                </dd>
              </div>
              {order.paidMinor > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted">{t("order.paid")}</dt>
                  <dd className="tabular-nums">
                    {formatPrice(order.paidMinor, order.currency, resolved)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section aria-labelledby="order-payment-heading">
            <h3 id="order-payment-heading" className="text-lg font-semibold text-ink-900">
              {t("order.paymentHeading")}
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("order.paymentMethodLabel")}</dt>
                <dd className="text-ink-900">
                  {order.paymentMethod
                    ? t(`paymentMethod.${order.paymentMethod}`)
                    : t("orderStatus.pending_payment")}
                </dd>
              </div>
            </dl>

            {/* No payment is taken on the site, so there is nothing to retry
                here. The order is confirmed by our team contacting the customer
                using the details they provided. */}
          </section>
        </div>

        <aside aria-labelledby="order-summary-heading" className="lg:col-span-1">
          <div className="space-y-4 rounded-card border border-border bg-surface-alt p-6">
            <h3 id="order-summary-heading" className="text-base font-semibold text-ink-900">
              {t("order.referenceLabel")}
            </h3>
            <p className="font-mono text-sm text-ink-900">{order.reference}</p>

            <p className="text-sm text-muted">
              {t("order.placedOn", { date: formatDate(order.placedAt, resolved) })}
            </p>

            <p>
              <Badge tone={statusTone(order.status)}>{statusLabel}</Badge>
            </p>

            <div>
              <h4 className="text-sm font-semibold text-ink-900">
                {t("order.fulfillmentHeading")}
              </h4>
              {order.fulfillment === "pickup" ? (
                <p className="mt-1 text-sm text-body">{t("order.collection")}</p>
              ) : (
                <address className="mt-1 text-sm not-italic text-body">
                  <span className="block text-muted">{t("order.deliveryTo")}</span>
                  {order.deliveryAddressLine1}
                  <br />
                  {order.deliveryAddressLine2 ? (
                    <>
                      {order.deliveryAddressLine2}
                      <br />
                    </>
                  ) : null}
                  {order.deliveryCity}
                </address>
              )}
            </div>

            <ButtonLink
              href={`/${resolved}${STORE_PATH}`}
              variant="secondary"
              className="w-full"
            >
              {t("order.backToStore")}
            </ButtonLink>
          </div>
        </aside>
      </div>
    </SectionBand>
  );
}

function statusTone(status: OrderStatus): "success" | "info" | "warning" | "danger" {
  switch (status) {
    case "paid":
    case "processing":
    case "fulfilled":
      return "success";
    case "pending_payment":
      return "warning";
    case "cancelled":
    case "refunded":
      return "danger";
    default:
      return "info";
  }
}

/** The plain-language explanation for the order's current state. */
function renderStatusNotice(input: {
  status: OrderStatus;
  t: ReturnType<typeof createTranslator>["t"];
}) {
  const { status, t } = input;

  if (status === "pending_payment") {
    return (
      <Alert tone="info" title={t("order.contactNoticeHeading")}>
        {t("order.contactNoticeBody")}
      </Alert>
    );
  }

  if (status === "paid") {
    return (
      <Alert tone="success" title={t("order.paidHeading")}>
        {t("order.paidBody")}
      </Alert>
    );
  }

  if (status === "cancelled") {
    return (
      <Alert tone="error" title={t("order.cancelledHeading")}>
        {t("order.cancelledBody")}
      </Alert>
    );
  }

  if (status === "refunded") {
    return (
      <Alert tone="info" title={t("order.refundedHeading")}>
        {t("order.refundedBody")}
      </Alert>
    );
  }

  // processing / fulfilled: the order is paid and progressing, so the paid
  // message is still the accurate one.
  return (
    <Alert tone="success" title={t("order.paidHeading")}>
      {t("order.paidBody")}
    </Alert>
  );
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CM" : "en-GB", {
    dateStyle: "long",
  }).format(new Date(iso));
}
