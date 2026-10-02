-- =============================================================================
-- Phase 13 — Revoke the browser EXECUTE grant on `place_order`.
--
-- `place_order` was carried on the Phase 12 allow-list as "guest checkout",
-- on the assumption that the storefront calls it through the publishable key.
-- It does not: the only caller is `submitCheckout` in
-- `src/lib/orders/checkout-actions.ts`, and that uses `createAdminClient()`
-- (the service-role key, server-only). No Edge Function and no SQL caller
-- invokes it. The browser grant is therefore not load-bearing, and the function
-- is a `SECURITY DEFINER` write that bypasses RLS entirely.
--
-- What the grant exposed, even though the application never used it:
--
--   * The function authorizes a cart by `id` and `status = 'active'` alone. The
--     comment in its body says "belonging to this visitor", but `carts` carries
--     no per-visitor identifier to check against, so any holder of a cart id
--     could convert another visitor's basket into a pending order.
--   * `carts` and `cart_items` have no browser policy by design — every read and
--     write goes through the service-role client behind a Server Action that
--     validates the opaque token. `place_order` was the one path that let a
--     browser key name a cart id directly.
--   * `p_customer_id` is caller-supplied, so an order could be attributed to a
--     different account than the one making the call.
--
-- None of these is reachable through the app (cart ids are never returned to the
-- browser), so this is hardening rather than an incident fix. The change is
-- deliberately minimal: revoke, do not touch the body. The function keeps its
-- service-role grant and checkout is unaffected.
--
-- A caller-scoped redesign — pass the cart token and derive `p_customer_id` from
-- `auth.uid()` inside the function — is the durable fix, but it is not needed
-- while the only caller is trusted and it would be a behaviour change to a
-- payment path. It is recorded in `docs/PROJECT_BRIEF.md` as follow-up work.
-- =============================================================================

revoke execute on function public.place_order(
  text, uuid, uuid, text, text, text, public.locale_code,
  public.order_fulfillment, public.payment_method, text, text, text, uuid, text, integer
) from public, anon, authenticated;

-- The service-role grant is what the checkout action relies on; assert it rather
-- than assume the earlier migration's blanket grant is still in force.
grant execute on function public.place_order(
  text, uuid, uuid, text, text, text, public.locale_code,
  public.order_fulfillment, public.payment_method, text, text, text, uuid, text, integer
) to service_role;

comment on function public.place_order(
  text, uuid, uuid, text, text, text, public.locale_code,
  public.order_fulfillment, public.payment_method, text, text, text, uuid, text, integer
) is
  'Creates an order from a cart in one transaction: snapshots lines at catalogue prices, takes stock conditionally (no oversell), computes totals. Idempotent on p_idempotency_key. Service-role only — callable from the server-side checkout action, never from a browser key.';
