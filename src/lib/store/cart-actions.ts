"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { STORE_PATH } from "@/lib/config/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addItemToCart,
  ensureCart,
  getCartByToken,
  readCartToken,
  removeItemFromCart,
  setItemQuantity,
  writeCartToken,
} from "@/lib/store/cart";

/**
 * Cart Server Actions.
 *
 * Every action re-reads the price and stock from the database rather than
 * trusting the request. A price posted from the browser is not evidence of
 * anything: a visitor could set it to one franc. The only values taken from the
 * client are the product id and the quantity, and both are validated.
 *
 * Actions return a discriminated result instead of throwing, so the form can show
 * a message next to the button rather than triggering the error boundary.
 */

export type CartActionResult =
  | { ok: true; itemCount: number }
  | { ok: false; error: string };

function clampQuantity(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(Math.trunc(parsed), 999));
}

/** Resolve the acting cart, creating one when the visitor has none yet. */
async function resolveCart(locale: Locale) {
  const cart = await ensureCart(locale);
  if (!cart) return null;
  // Persist the token when a new cart was created; the action context permits
  // the cookie write that a Server Component cannot perform.
  if (cart.token !== (await readCartToken())) {
    await writeCartToken(cart.token);
  }
  return cart;
}

export async function addToCartAction(input: {
  productId: string;
  quantity?: number;
  locale: string;
}): Promise<CartActionResult> {
  const locale: Locale = isLocale(input.locale) ? input.locale : "en";

  if (!input.productId || typeof input.productId !== "string") {
    return { ok: false, error: "invalid_product" };
  }

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // The price and currency come from the database, never from the request.
  const { data: product } = await supabase
    .from("products")
    .select("id, price_minor, currency, stock, publish_state, availability")
    .eq("id", input.productId)
    .eq("publish_state", "published")
    .maybeSingle();

  if (!product) return { ok: false, error: "unavailable" };

  if (product.stock <= 0 || product.availability === "discontinued") {
    return { ok: false, error: "out_of_stock" };
  }

  const cart = await resolveCart(locale);
  if (!cart) return { ok: false, error: "unconfigured" };

  const quantity = clampQuantity(input.quantity ?? 1);
  const result = await addItemToCart({
    cartId: cart.id,
    productId: product.id,
    quantity,
    unitPriceMinor: product.price_minor,
    currency: product.currency,
  });

  if (!result.ok) return { ok: false, error: "write_failed" };

  const updated = await getCartByToken(cart.token);
  revalidatePath(`/${locale}${STORE_PATH}/cart`);

  return { ok: true, itemCount: updated?.itemCount ?? quantity };
}

export async function updateCartItemAction(input: {
  itemId: string;
  quantity: number;
  locale: string;
}): Promise<CartActionResult> {
  const locale: Locale = isLocale(input.locale) ? input.locale : "en";

  const token = await readCartToken();
  if (!token) return { ok: false, error: "no_cart" };

  const cart = await getCartByToken(token);
  if (!cart) return { ok: false, error: "no_cart" };

  const quantity = Math.max(
    0,
    Math.min(Math.trunc(Number(input.quantity) || 0), 999),
  );
  const result = await setItemQuantity({
    cartId: cart.id,
    itemId: input.itemId,
    quantity,
  });

  if (!result.ok) return { ok: false, error: "write_failed" };

  const updated = await getCartByToken(cart.token);
  revalidatePath(`/${locale}${STORE_PATH}/cart`);
  return { ok: true, itemCount: updated?.itemCount ?? 0 };
}

export async function removeCartItemAction(input: {
  itemId: string;
  locale: string;
}): Promise<CartActionResult> {
  const locale: Locale = isLocale(input.locale) ? input.locale : "en";

  const token = await readCartToken();
  if (!token) return { ok: false, error: "no_cart" };

  const cart = await getCartByToken(token);
  if (!cart) return { ok: false, error: "no_cart" };

  const result = await removeItemFromCart({
    cartId: cart.id,
    itemId: input.itemId,
  });

  if (!result.ok) return { ok: false, error: "write_failed" };

  const updated = await getCartByToken(cart.token);
  revalidatePath(`/${locale}${STORE_PATH}/cart`);
  return { ok: true, itemCount: updated?.itemCount ?? 0 };
}
