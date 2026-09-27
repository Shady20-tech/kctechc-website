"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  changeOrderStatus,
  recordManualPayment,
  type OrderActionState,
} from "@/lib/orders/admin-actions";
import type { OrderStatus } from "@/lib/orders/types";

/**
 * Admin order controls.
 *
 * Two forms with two different purposes and two different risk profiles, so they
 * are kept visually separate rather than merged into one status dropdown:
 *
 *   * **Status** moves the order along its lifecycle. `paid` is deliberately
 *     absent — it is not a status an operator picks, it is the result of money
 *     arriving.
 *   * **Record bank transfer** is the one manual route to `paid`, offered only
 *     for a bank-transfer order. It says plainly that it asserts money was
 *     received, because that is what it is: a human attesting to a fact the
 *     system could not observe.
 */
export function AdminOrderControls({
  locale,
  orderId,
  currentStatus,
  paymentMethod,
  allowedStatuses,
}: {
  locale: Locale;
  orderId: string;
  currentStatus: OrderStatus;
  paymentMethod: string | null;
  allowedStatuses: readonly OrderStatus[];
}) {
  const t = createTranslator(locale).t;

  const [statusState, statusAction, statusPending] = useActionState<
    OrderActionState,
    FormData
  >(changeOrderStatus, { status: "idle" });

  const [paymentState, paymentAction, paymentPending] = useActionState<
    OrderActionState,
    FormData
  >(recordManualPayment, { status: "idle" });

  const canRecordManual =
    paymentMethod === "bank_transfer" && currentStatus === "pending_payment";

  return (
    <div className="space-y-8">
      {/* Status --------------------------------------------------------- */}
      <form action={statusAction} className="space-y-4">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="locale" value={locale} />

        {statusState.status === "updated" ? (
          <Alert tone="success">{t("adminOrder.updated")}</Alert>
        ) : null}
        {statusState.status === "invalid_transition" ? (
          <Alert tone="error">{t("adminOrder.invalidTransition")}</Alert>
        ) : null}
        {statusState.status === "forbidden" ? (
          <Alert tone="error">{t("adminOrder.forbidden")}</Alert>
        ) : null}
        {statusState.status === "error" ? (
          <Alert tone="error">{t("adminOrder.actionError")}</Alert>
        ) : null}

        {allowedStatuses.length === 0 ? (
          <p className="text-sm text-muted">{t("adminOrder.noTransitions")}</p>
        ) : (
          <>
            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-ink-900"
              >
                {t("adminOrder.newStatus")}
              </label>
              <select
                id="status"
                name="status"
                required
                className="mt-1 block w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-sm"
              >
                {allowedStatuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`orderStatus.${status}`)}
                  </option>
                ))}
              </select>
            </div>

            <TextField
              id="note"
              name="note"
              label={t("adminOrder.noteLabel")}
              hint={t("adminOrder.noteHint")}
            />

            <Button type="submit" variant="secondary" disabled={statusPending}>
              {statusPending ? t("adminOrder.saving") : t("adminOrder.saveStatus")}
            </Button>
          </>
        )}
      </form>

      {/* Manual bank-transfer confirmation ------------------------------- */}
      {canRecordManual ? (
        <form
          action={paymentAction}
          className="space-y-4 rounded-card border border-border-strong p-4"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="locale" value={locale} />

          <h3 className="text-base font-semibold text-ink-900">
            {t("adminOrder.manualHeading")}
          </h3>
          <p className="text-sm text-muted">{t("adminOrder.manualIntro")}</p>

          {paymentState.status === "paid_recorded" ? (
            <Alert tone="success">{t("adminOrder.manualRecorded")}</Alert>
          ) : null}
          {paymentState.status === "invalid_transition" ? (
            <Alert tone="error">{t("adminOrder.manualNotApplicable")}</Alert>
          ) : null}
          {paymentState.status === "forbidden" ? (
            <Alert tone="error">{t("adminOrder.forbidden")}</Alert>
          ) : null}
          {paymentState.status === "error" ? (
            <Alert tone="error">{t("adminOrder.actionError")}</Alert>
          ) : null}

          <TextField
            id="manual-note"
            name="note"
            label={t("adminOrder.manualNoteLabel")}
            hint={t("adminOrder.manualNoteHint")}
          />

          <Button type="submit" variant="primary" disabled={paymentPending}>
            {paymentPending ? t("adminOrder.saving") : t("adminOrder.manualSubmit")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
