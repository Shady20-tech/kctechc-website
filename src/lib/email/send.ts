import "server-only";

import { Resend } from "resend";

import { SITE } from "@/lib/config/site";
import {
  orderNotificationRecipients,
  serverEnv,
} from "@/lib/config/server-env";
import { createTranslator } from "@/lib/i18n/translator";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Transactional email through Resend.
 *
 * Two constraints shape this module.
 *
 * First, it must never claim an email was sent when it was not. `RESEND_API_KEY`
 * is optional (see `serverEnv`), and the brief is explicit that a missing
 * external service is reported rather than simulated. Every function returns a
 * discriminated result and the caller decides what to do with it; nothing throws
 * to the surface on a provider failure, because a notification is a side effect
 * of a stored inquiry or order, not part of the transaction itself.
 *
 * Second, all customer-facing copy is resolved through the same static message
 * dictionary the site renders with, in the locale the visitor used. A customer
 * who wrote in French should not receive an English confirmation.
 *
 * The body is built from escaped, hand-assembled HTML rather than a template
 * engine. The only interpolated values are the visitor's own inputs and
 * server-generated references, so `escapeHtml` is what stops a name like
 * `<b>x</b>` from becoming markup in the notification inbox.
 */

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; error: "unconfigured" | "send_failed" };

/** Escape the five characters that can break out of HTML text or an attribute. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Row = { label: string; value: string };

/**
 * A plain, readable notification body. No branding, no tracking pixels: the
 * message exists to deliver facts, and anything more would be decoration a
 * recipient cannot act on.
 */
function renderRows(rows: readonly Row[]): string {
  const cells = rows
    .filter((row) => row.value.trim() !== "")
    .map(
      (row) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">${escapeHtml(
          row.label,
        )}</td><td style="padding:4px 0">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0">${cells}</table>`;
}

/** Build the shared envelope and hand it to Resend. */
async function send(input: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<EmailResult> {
  if (!serverEnv.resendApiKey) return { ok: false, error: "unconfigured" };
  if (!serverEnv.emailFrom) return { ok: false, error: "unconfigured" };

  try {
    const resend = new Resend(serverEnv.resendApiKey);
    const { data, error } = await resend.emails.send({
      from: serverEnv.emailFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    if (error || !data) return { ok: false, error: "send_failed" };
    return { ok: true, id: data.id };
  } catch {
    // A provider outage or a network error must not take down the request that
    // triggered the notification. The caller records the outcome.
    return { ok: false, error: "send_failed" };
  }
}

/** Where internal notifications go: the configured inbox, else the public email. */
function internalRecipient(): string {
  return serverEnv.emailContactTo ?? SITE.email;
}

/**
 * Notify the business that a contact or quote inquiry arrived.
 *
 * Sent after the row is stored, and addressed to the internal inbox with the
 * visitor as `replyTo`, so replying from the inbox reaches the customer without
 * the visitor's address being spoofed into the `From` header.
 */
export async function sendInquiryNotification(input: {
  reference: string;
  fullName: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  department: string | null;
  service: string | null;
  source: string;
  locale: Locale;
}): Promise<EmailResult> {
  const t = createTranslator(input.locale).t;
  const rows: Row[] = [
    { label: t("email.inquiry.reference"), value: input.reference },
    { label: t("email.inquiry.name"), value: input.fullName },
    { label: t("email.inquiry.email"), value: input.email },
    { label: t("email.inquiry.phone"), value: input.phone ?? "" },
    { label: t("email.inquiry.department"), value: input.department ?? "" },
    { label: t("email.inquiry.service"), value: input.service ?? "" },
    { label: t("email.inquiry.source"), value: input.source },
    { label: t("email.inquiry.subject"), value: input.subject },
    { label: t("email.inquiry.message"), value: input.message },
  ];

  return send({
    to: internalRecipient(),
    replyTo: input.email,
    subject: t("email.inquiry.subjectLine", { reference: input.reference }),
    html: `<h2>${escapeHtml(t("email.inquiry.heading"))}</h2>${renderRows(rows)}`,
  });
}

/**
 * Confirm to the customer that their order was received.
 *
 * Deliberately says the order is awaiting confirmation, not that it is paid. No
 * payment is taken on the site, so an email that implied money had changed hands
 * would be false.
 */
export async function sendOrderConfirmation(input: {
  reference: string;
  email: string;
  fullName: string;
  totalFormatted: string;
  locale: Locale;
}): Promise<EmailResult> {
  const t = createTranslator(input.locale).t;
  const rows: Row[] = [
    { label: t("email.order.reference"), value: input.reference },
    { label: t("email.order.name"), value: input.fullName },
    { label: t("email.order.total"), value: input.totalFormatted },
  ];

  return send({
    to: input.email,
    subject: t("email.order.subjectLine", { reference: input.reference }),
    html: `<h2>${escapeHtml(t("email.order.heading"))}</h2><p>${escapeHtml(
      t("email.order.intro"),
    )}</p>${renderRows(rows)}`,
  });
}

/**
 * Notify the business that an order was sent.
 *
 * This replaces a payment-gateway webhook as the signal that an order needs a
 * human: the site takes no payment, so an order is "done" when it reaches the
 * team. Sent to `orderNotificationRecipients()` (the operational inboxes, else
 * the public contact addresses) with the customer as `replyTo`, so a reply from
 * the inbox reaches the customer without spoofing the `From` header.
 *
 * The `paymentMethod` is the customer's *intent*, presented under an "intent"
 * label so an operator cannot mistake it for money already received. The line
 * items and total are included so the team can confirm stock and price on the
 * call.
 */
export async function sendOrderNotificationToAdmin(input: {
  reference: string;
  fullName: string;
  email: string;
  phone: string | null;
  paymentMethodLabel: string;
  fulfillmentLabel: string;
  addressLines: readonly string[];
  deliveryNote: string | null;
  items: readonly { title: string; quantity: number; lineTotalFormatted: string }[];
  totalFormatted: string;
  currency: string;
  locale: Locale;
  siteLocale: Locale;
  placedAtFormatted: string;
}): Promise<EmailResult> {
  // The notification body is read by staff, so the labels follow the *site*
  // locale of the order rather than the customer's UI language, which is carried
  // as its own row.
  const t = createTranslator(input.siteLocale).t;

  const itemLines = input.items
    .map(
      (item) =>
        `${item.title} × ${item.quantity} — ${item.lineTotalFormatted}`,
    )
    .join("\n");

  const rows: Row[] = [
    { label: t("email.orderAdmin.reference"), value: input.reference },
    { label: t("email.orderAdmin.name"), value: input.fullName },
    { label: t("email.orderAdmin.email"), value: input.email },
    { label: t("email.orderAdmin.phone"), value: input.phone ?? "" },
    { label: t("email.orderAdmin.method"), value: input.paymentMethodLabel },
    { label: t("email.orderAdmin.fulfillment"), value: input.fulfillmentLabel },
    {
      label: t("email.orderAdmin.address"),
      value: input.addressLines.join(", "),
    },
    { label: t("email.orderAdmin.note"), value: input.deliveryNote ?? "" },
    { label: t("email.orderAdmin.items"), value: itemLines },
    { label: t("email.orderAdmin.total"), value: input.totalFormatted },
    { label: t("email.orderAdmin.locale"), value: input.locale },
    { label: t("email.orderAdmin.placedAt"), value: input.placedAtFormatted },
  ];

  return send({
    to: orderNotificationRecipients(),
    replyTo: input.email,
    subject: t("email.orderAdmin.subjectLine", {
      reference: input.reference,
      total: input.totalFormatted,
    }),
    html: `<h2>${escapeHtml(t("email.orderAdmin.heading"))}</h2><p>${escapeHtml(
      t("email.orderAdmin.intro"),
    )}</p>${renderRows(rows)}`,
  });
}
