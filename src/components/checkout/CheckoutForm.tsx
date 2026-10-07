"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { submitCheckout } from "@/lib/orders/checkout-actions";
import {
  CHECKOUT_ERROR_KEYS,
  type CheckoutFieldErrors,
  type CheckoutState,
} from "@/lib/validation/checkout";
import {
  FULFILLMENT_METHODS,
  PAYMENT_METHODS,
  type FulfillmentMethod,
  type PaymentMethod,
} from "@/lib/orders/types";
import { formatPrice } from "@/lib/store/types";
import { trackEcommerce } from "@/lib/analytics/track";
import type { AnalyticsItem } from "@/lib/analytics/events";

/**
 * Checkout form.
 *
 * The form's only job is to collect the customer's choices and hand them to the
 * Server Action. It submits nothing about money or stock: there is no hidden
 * total field, and the summary it renders is a display of data the *server* sent
 * down, not a value the browser computes and sends back. The total that matters
 * is computed inside `place_order` from the catalogue.
 *
 * The idempotency key is generated once and held in a ref, so a double-click or a
 * retry after a dropped response carries the same key and cannot create a second
 * order.
 */

type CheckoutItem = {
  id: string;
  productId: string;
  title: string;
  slug: string;
  quantity: number;
  /** The authoritative price, from the database, used for display and totals. */
  unitPriceMinor: number;
};

export function CheckoutForm({
  locale,
  items,
  subtotalMinor,
  currency,
}: {
  locale: Locale;
  items: CheckoutItem[];
  subtotalMinor: number;
  currency: string;
}) {
  const t = createTranslator(locale).t;

  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>("delivery");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash_on_confirmation");

  // Stable for the lifetime of this form. Regenerating it on each render would
  // make every keystroke a new checkout. A lazy `useState` initializer is the
  // idiomatic way to hold a value that is computed once and rendered.
  const [idempotencyKey] = useState(() => newIdempotencyKey());

  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    submitCheckout,
    { status: "idle" },
  );

  // Report the checkout start once, so the funnel has a top. The items are the
  // server's own line data, reduced to the allowlisted analytics fields.
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    trackEcommerce("begin_checkout", {
      value: subtotalMinor,
      currency,
      items: items.map(
        (item, index): AnalyticsItem => ({
          item_id: item.productId,
          item_name: item.title,
          price: item.unitPriceMinor,
          quantity: item.quantity,
          index,
        }),
      ),
    });
  }, [items, subtotalMinor, currency]);

  // On success the Server Action redirects the browser itself, so there is no
  // post-submit navigation to perform here. The form only reports the states the
  // customer has to act on.

  const errors = state.status === "invalid" ? state.errors : {};
  const errorText = (field: keyof CheckoutFieldErrors): string | undefined => {
    if (!errors[field]) return undefined;
    // The schema reports a stable code per field; the form owns the wording, so
    // an internal token like `consentRequired` never reaches a customer.
    return t(`checkout.${CHECKOUT_ERROR_KEYS[field]}`);
  };
  const deliveryMinor = fulfillment === "pickup" ? 0 : 0;
  const totalMinor = subtotalMinor + deliveryMinor;

  // Keyed to the *offered* methods, not to every `PaymentMethod`. `card` is in
  // the stored enum for legacy rows but is not offered, so requiring a label for
  // it would put a dead entry in the map that reads like a live option.
  const paymentLabels: Record<
    (typeof PAYMENT_METHODS)[number],
    { label: string; hint: string }
  > = {
    cash_on_confirmation: {
      label: t("checkout.paymentCash"),
      hint: t("checkout.paymentCashHint"),
    },
    mobile_money_mtn: { label: t("checkout.paymentMtn"), hint: t("checkout.paymentMtnHint") },
    mobile_money_orange: { label: t("checkout.paymentOrange"), hint: t("checkout.paymentOrangeHint") },
    bank_transfer: { label: t("checkout.paymentBank"), hint: t("checkout.paymentBankHint") },
  };

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {/* Locale travels so the confirmation page and the audit entry agree. */}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {state.status === "invalid" && Object.keys(errors).length > 0 ? (
        <Alert tone="error" title={t("checkout.errorHeading")}>
          <p className="font-medium">{t("checkout.errorSummaryHeading")}</p>
          <ul className="mt-1 list-disc pl-5">
            {(Object.keys(errors) as (keyof CheckoutFieldErrors)[])
              .filter((field) => errors[field])
              .map((field) => (
                <li key={field}>{t(`checkout.${CHECKOUT_ERROR_KEYS[field]}`)}</li>
              ))}
          </ul>
        </Alert>
      ) : null}

      {state.status === "empty_cart" ? (
        <Alert tone="warning" title={t("checkout.emptyCartTitle")}>
          {t("checkout.emptyCartBody")}
        </Alert>
      ) : null}

      {state.status === "out_of_stock" ? (
        <Alert tone="error" title={t("checkout.outOfStockTitle")}>
          {t("checkout.outOfStockBody", { item: state.item })}
        </Alert>
      ) : null}

      {state.status === "rate_limited" ? (
        <Alert tone="warning" title={t("checkout.rateLimitedTitle")}>
          {t("checkout.rateLimitedBody")}
        </Alert>
      ) : null}

      {state.status === "unconfigured" ? (
        <Alert tone="error" title={t("checkout.unconfiguredTitle")}>
          {t("checkout.unconfiguredBody")}
        </Alert>
      ) : null}

      {state.status === "error" ? (
        <Alert tone="error" title={t("checkout.errorTitle")}>
          {t("checkout.errorBody")}
        </Alert>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-ink-900">
          {t("checkout.contactHeading")}
        </legend>
        <p className="text-sm text-muted">{t("checkout.contactIntro")}</p>

        <TextField
          id="fullName"
          name="fullName"
          label={t("checkout.fieldFullName")}
          autoComplete="name"
          required
          requiredLabel={t("common.required")}
          error={errorText("fullName")}
        />
        <TextField
          id="email"
          name="email"
          type="email"
          label={t("checkout.fieldEmail")}
          hint={t("checkout.fieldEmailHint")}
          autoComplete="email"
          required
          requiredLabel={t("common.required")}
          error={errorText("email")}
        />
        <TextField
          id="phone"
          name="phone"
          type="tel"
          label={t("checkout.fieldPhone")}
          hint={t("checkout.fieldPhoneHint")}
          autoComplete="tel"
          error={errorText("phone")}
        />
      </fieldset>

      {/* ---------------------------------------------------------------- */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-ink-900">
          {t("checkout.fulfillmentHeading")}
        </legend>
        <p className="text-sm text-muted">{t("checkout.fulfillmentIntro")}</p>

        <div className="space-y-3">
          {FULFILLMENT_METHODS.map((method) => (
            <label
              key={method}
              className="flex items-start gap-3 rounded-card border border-border-strong p-3 text-sm"
            >
              <input
                type="radio"
                name="fulfillment"
                value={method}
                checked={fulfillment === method}
                onChange={() => setFulfillment(method)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="font-medium text-ink-900">
                {method === "delivery"
                  ? t("checkout.fulfillmentDelivery")
                  : t("checkout.fulfillmentPickup")}
              </span>
            </label>
          ))}
        </div>

        {fulfillment === "delivery" ? (
          <div className="space-y-4">
            <TextField
              id="deliveryAddressLine1"
              name="deliveryAddressLine1"
              label={t("checkout.fieldAddressLine1")}
              autoComplete="address-line1"
              required
              requiredLabel={t("common.required")}
              error={errorText("deliveryAddressLine1")}
            />
            <TextField
              id="deliveryAddressLine2"
              name="deliveryAddressLine2"
              label={t("checkout.fieldAddressLine2")}
              hint={t("checkout.fieldAddressLine2Hint")}
              autoComplete="address-line2"
            />
            <TextField
              id="deliveryCity"
              name="deliveryCity"
              label={t("checkout.fieldCity")}
              autoComplete="address-level2"
              required
              requiredLabel={t("common.required")}
              error={errorText("deliveryCity")}
            />
            <TextAreaField
              id="deliveryNotes"
              name="deliveryNotes"
              label={t("checkout.fieldDeliveryNotes")}
              hint={t("checkout.fieldDeliveryNotesHint")}
              rows={3}
            />
          </div>
        ) : null}
      </fieldset>

      {/* ---------------------------------------------------------------- */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-ink-900">
          {t("checkout.paymentHeading")}
        </legend>
        <p className="text-sm text-muted">{t("checkout.paymentIntro")}</p>

        <div className="space-y-3">
          {PAYMENT_METHODS.map((method) => {
            const { label, hint } = paymentLabels[method];
            return (
              <label
                key={method}
                className="flex items-start gap-3 rounded-card border border-border-strong p-3 text-sm"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="font-medium text-ink-900">{label}</span>
                  <span className="mt-0.5 block text-muted">{hint}</span>
                </span>
              </label>
            );
          })}
        </div>

        {/* Reassurance about payment data. Stated because it is true: no
            card or mobile-money details are collected here. */}
        <p className="text-sm text-muted">{t("checkout.secureNote")}</p>
      </fieldset>

      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="summary-heading" className="rounded-card border border-border-strong p-4">
        <h2 id="summary-heading" className="text-lg font-semibold text-ink-900">
          {t("checkout.summaryHeading")}
        </h2>

        <table className="mt-3 w-full text-sm">
          <caption className="visually-hidden">{t("checkout.summaryHeading")}</caption>
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
            {items.map((item) => {
              const lineTotalMinor = item.unitPriceMinor * item.quantity;
              return (
                <tr key={item.id} className="border-t border-border-strong">
                  <td className="py-2 pr-2 text-ink-900">{item.title}</td>
                  <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatPrice(lineTotalMinor, currency, locale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <dl className="mt-4 space-y-1 border-t border-border-strong pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("checkout.summarySubtotal")}</dt>
            <dd className="tabular-nums text-ink-900">
              {formatPrice(subtotalMinor, currency, locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("checkout.summaryDelivery")}</dt>
            <dd className="tabular-nums text-ink-900">
              {fulfillment === "pickup"
                ? t("checkout.summaryDeliveryPickup")
                : deliveryMinor === 0
                  ? t("checkout.summaryDeliveryFree")
                  : formatPrice(deliveryMinor, currency, locale)}
            </dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>{t("checkout.summaryTotal")}</dt>
            <dd className="tabular-nums">{formatPrice(totalMinor, currency, locale)}</dd>
          </div>
        </dl>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">
          {t("checkout.reviewHeading")}
        </h2>
        <p className="text-sm text-muted">{t("checkout.reviewIntro")}</p>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4" required />
          <span className="text-body">
            {t("checkout.consentLabel")}{" "}
            <span className="text-muted">({t("common.required")})</span>
          </span>
        </label>
        {errorText("consent") ? (
          <p className="text-sm text-red-700">{errorText("consent")}</p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? t("checkout.submitting") : t("checkout.submit")}
        </Button>
      </section>
    </form>
  );
}

/**
 * A client-side idempotency key.
 *
 * `crypto.randomUUID` is available in every browser that supports the App
 * Router, with a `getRandomValues` fallback for the rare exception. The key is
 * not a secret — it only needs to be unique per checkout attempt — so it never
 * has to leave the browser's random source.
 */
function newIdempotencyKey(): string {
  // `crypto` is present in every browser that supports the App Router, but the
  // check keeps this honest rather than assuming.
  const webCrypto = globalThis.crypto as Crypto | undefined;
  if (!webCrypto) {
    // No Web Crypto: fall back to a timestamp plus random suffix, which is still
    // unique per attempt. This path is effectively unreachable in a supported
    // browser and exists so the function cannot throw.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  if (typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
