"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { retryPaymentAction } from "@/lib/orders/checkout-actions";

/**
 * Retry-payment button.
 *
 * The amount is never sent from here: the action re-reads the order and charges
 * its stored total. This component only asks for another attempt and follows the
 * link the provider returns.
 *
 * A pending mobile-money charge has no link to follow — the customer approves on
 * their handset — so the button reports that state instead of appearing to do
 * nothing.
 */
export function RetryPaymentButton({
  locale,
  orderReference,
}: {
  locale: Locale;
  orderReference: string;
}) {
  const t = createTranslator(locale).t;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<"failed" | "approval" | null>(null);

  const retry = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await retryPaymentAction({ orderReference });
      if (result.ok && "link" in result) {
        window.location.assign(result.link);
        return;
      }
      if (result.ok && "manual" in result) {
        // A bank transfer needs no redirect; the page already explains the next
        // step, so a reload shows the updated attempt.
        window.location.reload();
        return;
      }
      if (result.ok && "pending" in result) {
        setMessage("approval");
        return;
      }
      setMessage("failed");
    });
  };

  return (
    <div className="space-y-3">
      {message === "failed" ? (
        <Alert tone="error" title={t("order.failedHeading")}>
          {t("order.retryFailed")}
        </Alert>
      ) : null}
      {message === "approval" ? (
        <Alert tone="info">
          {t("checkout.paymentMtnHint")}
        </Alert>
      ) : null}

      <Button type="button" variant="primary" onClick={retry} disabled={pending}>
        {pending ? t("order.retrying") : t("order.retryPayment")}
      </Button>
    </div>
  );
}
