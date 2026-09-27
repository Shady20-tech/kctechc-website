import { z } from "zod";
import { emailSchema, localeSchema } from "./common";

/**
 * Checkout schema.
 *
 * The rule the whole phase turns on: **nothing money-related and nothing
 * stock-related is accepted from this form.** There is no field for a price, a
 * subtotal, a total, a discount or an availability flag. The cart is identified
 * by an opaque token cookie the browser cannot read, and every amount is read
 * from the database in `place_order`. A schema that accepted a total would make
 * the server-authoritative claim a fiction, regardless of what the code did with
 * it afterwards.
 *
 * The delivery fee is the one money value that travels, because it is a business
 * decision (a zone price) rather than something derivable from the catalogue.
 * It is clamped here and re-clamped in SQL, and it is forced to zero for a
 * pickup order in both places.
 */

const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .refine(
    (value) => value === "" || /^[+()\d\s.-]{6,40}$/.test(value),
    "invalidPhone",
  )
  .optional();

const optionalLine = z.string().trim().max(200).optional();
const optionalNotes = z.string().trim().max(1000).optional();

export const checkoutSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    email: emailSchema,
    phone: optionalPhone,
    locale: localeSchema,

    fulfillment: z.enum(["delivery", "pickup"]),
    paymentMethod: z.enum([
      "card",
      "mobile_money_mtn",
      "mobile_money_orange",
      "bank_transfer",
    ]),

    // Required for a delivery order, absent for pickup. The consistency rule
    // below is what enforces that; the fields are individually optional so a
    // pickup order does not have to invent an address.
    deliveryAddressLine1: optionalLine,
    deliveryAddressLine2: optionalLine,
    deliveryCity: z.string().trim().max(120).optional(),
    deliveryRegion: z.string().trim().max(120).optional(),
    deliveryNotes: optionalNotes,

    // The client's idempotency key. Required, and length-bounded: a short key is
    // likely a placeholder, and an empty one would make every submission a
    // distinct order.
    idempotencyKey: z.string().trim().min(8).max(128),

    consent: z.literal(true, { message: "consentRequired" }),
  })
  .refine(
    (value) =>
      value.fulfillment !== "delivery" ||
      (value.deliveryAddressLine1 !== undefined &&
        value.deliveryAddressLine1.length > 0 &&
        value.deliveryCity !== undefined &&
        value.deliveryCity.length > 0),
    { message: "deliveryAddressRequired", path: ["deliveryAddressLine1"] },
  );

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Field-level errors, keyed the way the form renders them.
 *
 * Same shape as the inquiry and quote schemas so the form components are shared.
 */
export type CheckoutFieldErrors = Partial<
  Record<
    | "fullName"
    | "email"
    | "phone"
    | "fulfillment"
    | "paymentMethod"
    | "deliveryAddressLine1"
    | "deliveryCity"
    | "consent"
    | "form",
    string
  >
>;

export function toCheckoutFieldErrors(
  issues: z.core.$ZodIssue[],
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  for (const issue of issues) {
    const key = (issue.path[0] as keyof CheckoutFieldErrors) ?? "form";
    // First error per field: the form shows one message per input, and the first
    // is the most specific.
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Maps a validation field to the message key that explains it.
 *
 * The schema reports a stable code per field; the form owns the wording. Keys
 * are looked up rather than interpolated so no raw code reaches the customer.
 */
export const CHECKOUT_ERROR_KEYS = {
  fullName: "errFullName",
  email: "errEmail",
  phone: "errPhone",
  fulfillment: "errFulfillment",
  paymentMethod: "errPaymentMethod",
  deliveryAddressLine1: "errAddress",
  deliveryCity: "errCity",
  consent: "errConsent",
  // A schema-level error not tied to one input (the delivery-address refinement
  // can surface here). Falls back to the general retry message.
  form: "errorBody",
} as const satisfies Record<keyof CheckoutFieldErrors, string>;

/** The result a checkout Server Action returns to the form. */
export type CheckoutState =
  | { status: "idle" }
  | { status: "invalid"; errors: CheckoutFieldErrors }
  | { status: "rate_limited" }
  | { status: "unconfigured" }
  | { status: "empty_cart" }
  | { status: "out_of_stock"; item: string }
  | { status: "error" };
