import { notFound, redirect } from "next/navigation";

import { AdminOrderControls } from "@/components/admin/AdminOrderControls";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { getOrderById } from "@/lib/orders/queries";
import { staffTransitions, type OrderStatus } from "@/lib/orders/types";

import { formatPrice } from "@/lib/store/types";

export const dynamic = "force-dynamic";

/** Admin: one order, with its controls, payment attempts and status timeline. */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Forders");
  }
  if (!state.profile || !isAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  // `leftAt` because the timeline below also needs the full history. The current
  // page only shows the latest, and the loader's `getOrderById` returns it.
  const allowed = staffTransitions(order.status);

  return (
    <>
      <PageIntro
        eyebrow={t("adminOrder.eyebrow")}
        heading={order.reference}
        intro={t("adminOrder.detailIntro")}
      />

      <p className="mt-4">
        <ButtonLink href="/admin/orders" variant="secondary" size="sm">
          {t("adminOrder.backToQueue")}
        </ButtonLink>
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section aria-labelledby="order-customer-heading">
            <h2 id="order-customer-heading" className="text-lg font-semibold text-ink-900">
              {t("adminOrder.customerHeading")}
            </h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">{t("adminOrder.colCustomer")}</dt>
                <dd className="text-ink-900">{order.fullName}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("checkout.fieldEmail")}</dt>
                <dd className="break-all text-ink-900">{order.email}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("checkout.fieldPhone")}</dt>
                <dd className="text-ink-900">{order.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("order.referenceLabel")}</dt>
                <dd className="font-mono text-ink-900">{order.reference}</dd>
              </div>
            </dl>

            {order.fulfillment === "delivery" ? (
              <address className="mt-4 text-sm not-italic text-body">
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
            ) : (
              <p className="mt-4 text-sm text-body">{t("order.collection")}</p>
            )}

            {order.deliveryNotes ? (
              <p className="mt-3 text-sm text-body">
                <span className="text-muted">{t("checkout.fieldDeliveryNotes")}: </span>
                {order.deliveryNotes}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="order-lines-heading">
            <h2 id="order-lines-heading" className="text-lg font-semibold text-ink-900">
              {t("order.itemsHeading")}
            </h2>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">{t("order.itemsHeading")}</caption>
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col">{t("checkout.summaryItem")}</th>
                  <th scope="col">{t("adminOrder.colSku")}</th>
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
                    <td className="py-2 pr-2 text-ink-900">{line.title}</td>
                    <td className="py-2 pr-2 font-mono text-xs text-muted">
                      {line.sku}
                    </td>
                    <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatPrice(line.lineTotalMinor, order.currency, "en")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className="mt-4 space-y-1 border-t border-border-strong pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t("order.subtotal")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.subtotalMinor, order.currency, "en")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("order.delivery")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.deliveryMinor, order.currency, "en")}
                </dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>{t("order.total")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.totalMinor, order.currency, "en")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("order.paid")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.paidMinor, order.currency, "en")}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="order-payments-heading">
            <h2 id="order-payments-heading" className="text-lg font-semibold text-ink-900">
              {t("adminOrder.paymentsHeading")}
            </h2>
            {order.payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("adminOrder.noPayments")}</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <caption className="sr-only">{t("adminOrder.paymentsHeading")}</caption>
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col">{t("adminOrder.colPaymentStatus")}</th>
                    <th scope="col">{t("order.paymentMethodLabel")}</th>
                    <th scope="col">{t("order.paymentProviderRef")}</th>
                    <th scope="col" className="text-right">
                      {t("adminOrder.colTotal")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-border-strong">
                      <td className="py-2 pr-2">
                        {t(`paymentStatus.${payment.status}`)}
                        {payment.failureReason ? (
                          <span className="block text-xs text-muted">
                            {payment.failureReason}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2">
                        {t(`paymentMethod.${payment.method}`)}
                      </td>
                      <td className="py-2 pr-2 break-all font-mono text-xs">
                        {payment.providerReference ?? "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatPrice(payment.amountMinor, payment.currency, "en")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside aria-labelledby="order-actions-heading" className="space-y-6 lg:col-span-1">
          <div className="space-y-4 rounded-card border border-border bg-surface-alt p-6">
            <h2 id="order-actions-heading" className="text-base font-semibold text-ink-900">
              {t("adminOrder.actionsHeading")}
            </h2>

            <p>
              <Badge tone={statusTone(order.status)}>
                {t(`orderStatus.${order.status}`)}
              </Badge>
            </p>

            <AdminOrderControls
              locale="en"
              orderId={order.id}
              currentStatus={order.status}
              paymentMethod={order.paymentMethod}
              allowedStatuses={allowed}
            />
          </div>

          {order.paymentMethod === "bank_transfer" &&
          order.status === "pending_payment" ? (
            <Alert tone="warning">{t("adminOrder.manualCaution")}</Alert>
          ) : null}
        </aside>
      </div>
    </>
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
