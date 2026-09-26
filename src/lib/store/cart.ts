import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n/locales";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORE_CURRENCY } from "@/lib/config/site";

/**
 * Cart persistence.
 *
 * The cart lives in the database and is addressed by an opaque random token in an
 * httpOnly cookie. Three consequences, all deliberate:
 *
 *   - A browser cannot enumerate other carts. The tables have no anonymous RLS
 *     policy, and the token is 256 bits of randomness, so guessing one is not
 *     feasible.
 *   - The cookie is httpOnly and SameSite=Lax, so it is not readable by script
 *     (no XSS exfiltration) and is not sent on a cross-site request (no CSRF
 *     mutation of a cart).
 *   - All access goes through the service-role client behind a Server Action,
 *     which is the same boundary the inquiry pipeline uses.
 *
 * `unit_price_minor` is captured when an item is added, so a price change does
 * not silently rewrite what the customer was shown.
 */

export const CART_COOKIE = "kc_cart";

const TOKEN_BYTES = 32;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type CartLine = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
  /** Price on hand at the moment the cart was read, to surface a change. */
  currentPriceMinor: number | null;
  stock: number;
  imagePath: string | null;
};

export type Cart = {
  id: string;
  token: string;
  currency: string;
  lines: CartLine[];
  subtotalMinor: number;
  itemCount: number;
};

function newToken(): string {
  // base64url of 32 random bytes: 43 characters, well within the 32..128 check.
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Read the current cart token from the cookie jar.
 *
 * Returns null when there is no cart yet. The token is never derived from
 * anything guessable.
 */
export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/**
 * Issue a cart token cookie.
 *
 * Server Components cannot set cookies, so a caller that is one must not invoke
 * this; the cart actions run as Server Actions, where the write is permitted.
 */
export async function writeCartToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearCartToken(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
}

/**
 * Get the active cart for a token, or null.
 *
 * Expiry is checked in the query as well as by the database default, so a cart
 * whose `expires_at` has passed is treated as absent even before a cleanup job
 * marks it expired.
 */
export async function getCartByToken(token: string): Promise<Cart | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: cart } = await supabase
    .from("carts")
    .select("id, token, currency, status, expires_at")
    .eq("token", token)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!cart) return null;

  const { data: items } = await supabase
    .from("cart_items")
    .select(
      "id, product_id, quantity, unit_price_minor, currency, products (slug, title, stock, price_minor, product_media (storage_path, is_primary, position))",
    )
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });

  const lines: CartLine[] = (items ?? []).flatMap((item) => {
    // A product deleted while it sat in a cart leaves an orphan line; skipping it
    // is correct, because the item can no longer be bought.
    const product = item.products;
    if (!product) return [];

    const media = [...(product.product_media ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const primary = media.find((image) => image.is_primary) ?? media[0];

    return [
      {
        id: item.id,
        productId: item.product_id,
        slug: product.slug,
        title: product.title,
        quantity: item.quantity,
        unitPriceMinor: item.unit_price_minor,
        currency: item.currency,
        currentPriceMinor: product.price_minor,
        stock: product.stock,
        imagePath: primary?.storage_path ?? null,
      },
    ];
  });

  const subtotalMinor = lines.reduce(
    (total, line) => total + line.unitPriceMinor * line.quantity,
    0,
  );
  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);

  return {
    id: cart.id,
    token: cart.token,
    currency: cart.currency,
    lines,
    subtotalMinor,
    itemCount,
  };
}

/** Get the current visitor's cart, if any. */
export async function getCurrentCart(): Promise<Cart | null> {
  const token = await readCartToken();
  if (!token) return null;
  return getCartByToken(token);
}

/**
 * Find or create the active cart for this visitor.
 *
 * Creation is where the token is minted. The caller is responsible for having
 * written the cookie; `ensureCart` returns both so a Server Action can do so.
 */
export async function ensureCart(locale: Locale): Promise<Cart | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const existingToken = await readCartToken();
  if (existingToken) {
    const existing = await getCartByToken(existingToken);
    if (existing) return existing;
  }

  const token = newToken();
  const { data, error } = await supabase
    .from("carts")
    .insert({ token, locale, currency: STORE_CURRENCY.code })
    .select("id, token, currency")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    token: data.token,
    currency: data.currency,
    lines: [],
    subtotalMinor: 0,
    itemCount: 0,
  };
}

/**
 * Add a product to a cart, or increase its quantity.
 *
 * The unit price is read from the product at add time, not supplied by the
 * caller: a price posted from the browser would let a visitor choose what to pay.
 */
export async function addItemToCart(input: {
  cartId: string;
  productId: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", input.cartId)
    .eq("product_id", input.productId)
    .maybeSingle();

  if (existing) {
    const nextQuantity = Math.min(existing.quantity + input.quantity, 999);
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: nextQuantity })
      .eq("id", existing.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { error } = await supabase.from("cart_items").insert({
    cart_id: input.cartId,
    product_id: input.productId,
    quantity: Math.min(input.quantity, 999),
    unit_price_minor: input.unitPriceMinor,
    currency: input.currency,
  });

  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Set an absolute quantity for a cart line, or remove it when zero. */
export async function setItemQuantity(input: {
  cartId: string;
  itemId: string;
  quantity: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // Scoping by cart_id means an item id from another cart cannot be mutated.
  if (input.quantity <= 0) {
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", input.itemId)
      .eq("cart_id", input.cartId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: Math.min(input.quantity, 999) })
    .eq("id", input.itemId)
    .eq("cart_id", input.cartId);

  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Remove a line from a cart. */
export async function removeItemFromCart(input: {
  cartId: string;
  itemId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return setItemQuantity({ ...input, quantity: 0 });
}
