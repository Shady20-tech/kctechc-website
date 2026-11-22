import type { Translator } from "@/lib/i18n/translator";

/**
 * Stable error codes from the cart Server Actions mapped to customer-facing text.
 *
 * A single generic sentence was shown for every failure, which is wrong for the
 * faults that retrying cannot fix: an `unconfigured` deployment (the service-role
 * key is absent, so the action has no database access) reported "please try
 * again", and the visitor could press the button forever without success. Each
 * code therefore gets the most specific honest message available, and only the
 * genuinely transient ones keep retry advice.
 *
 * This module has no `"use server"` directive on purpose: the directive would turn
 * every export into a callable endpoint, and a plain function beside the actions
 * fails the production build.
 */
export function cartErrorMessage(code: string, t: Translator["t"]): string {
  switch (code) {
    case "out_of_stock":
      return t("store.availability.out_of_stock");
    case "unavailable":
      return t("store.cart.errorUnavailable");
    case "unconfigured":
      return t("store.cart.errorUnconfigured");
    case "no_cart":
      // The cart cookie is gone — an expired or cleared session. Repeating the
      // same action cannot help; the visitor has to add the item again.
      return t("store.cart.errorExpired");
    default:
      return t("store.cart.errorGeneric");
  }
}
