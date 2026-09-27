-- =============================================================================
-- Give every `place_order` parameter a default.
--
-- PostgREST resolves an RPC overload by the *exact set* of named arguments in the
-- request body, and only accepts an omitted argument when that parameter has a
-- default. The checkout Server Action passes `undefined` for the values that have
-- no meaningful value for this order -- no signed-in customer, no phone, no
-- second address line, no region -- and supabase-js drops `undefined` from the
-- JSON body. With `p_customer_id` and `p_phone` lacking defaults, the resulting
-- argument set matched no overload and every checkout failed with PGRST202
-- ("Could not find the function public.place_order(...)"), a 404 that never
-- reached the database. `p_delivery_address_line2` and `p_delivery_region_id`
-- were the same latent trap, masked only because the action currently always
-- sends them.
--
-- Defaulting the parameters the caller may legitimately omit makes the function
-- resolvable for every combination the app can send. Each default is the same
-- absence the application already expresses.
--
-- `create or replace` alone would not do: a changed parameter list creates an
-- *additional* overload instead of replacing the old one, leaving the broken
-- zero-default version matched first for the fully-qualified call. The old
-- signature is dropped explicitly, which is safe because EXECUTE comes from
-- PUBLIC's default privileges rather than a per-function grant.
--
-- The body is unchanged from `20260101000034_order_state_machine.sql` -- only the
-- parameter list differs. It is reproduced here because PostgreSQL has no syntax
-- for adding defaults to existing parameters in place.
-- =============================================================================

drop function if exists public.place_order(
  text, uuid, uuid, text, text, text, public.locale_code,
  public.order_fulfillment, public.payment_method, text, text, text, uuid, text, integer
);

create or replace function public.place_order(
  p_idempotency_key text,
  p_cart_id uuid,
  p_customer_id uuid default null,
  p_email text default null,
  p_full_name text default null,
  p_phone text default null,
  p_locale public.locale_code default 'en',
  p_fulfillment public.order_fulfillment default 'delivery',
  p_payment_method public.payment_method default null,
  p_delivery_address_line1 text default null,
  p_delivery_address_line2 text default null,
  p_delivery_city text default null,
  p_delivery_region_id uuid default null,
  p_delivery_notes text default null,
  p_delivery_minor integer default 0
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_line record;
  v_line_count integer := 0;
  v_subtotal integer := 0;
  v_updated integer;
begin
  -- Idempotency: a repeated checkout submission returns the original order
  -- rather than creating a second one. Scoped the same way as the unique indexes.
  select * into v_order
    from public.orders o
   where o.idempotency_key = p_idempotency_key
     and (
       (p_customer_id is not null and o.customer_id = p_customer_id)
       or (p_customer_id is null and o.customer_id is null and o.email = p_email::extensions.citext)
     );

  if found then
    return v_order;
  end if;

  if p_cart_id is null then
    raise exception 'A cart is required to place an order'
      using errcode = 'check_violation';
  end if;

  -- Only an active cart belonging to this visitor can be converted. This stops a
  -- guessed cart id being used to order someone else's basket.
  if not exists (
    select 1 from public.carts
     where id = p_cart_id and status = 'active'
  ) then
    raise exception 'Cart is not available for checkout'
      using errcode = 'check_violation';
  end if;

  insert into public.orders (
    reference, status, customer_id, email, full_name, phone, locale, currency,
    fulfillment, delivery_address_line1, delivery_address_line2, delivery_city,
    delivery_region_id, delivery_notes, cart_id, idempotency_key,
    delivery_minor, payment_method, access_token
  ) values (
    public.generate_order_reference(), 'pending_payment', p_customer_id,
    p_email::extensions.citext, p_full_name, nullif(p_phone, ''), p_locale, 'XAF',
    p_fulfillment, p_delivery_address_line1, p_delivery_address_line2,
    p_delivery_city, p_delivery_region_id, p_delivery_notes, p_cart_id,
    p_idempotency_key,
    -- A pickup order never carries a delivery fee, whatever the caller sent.
    case when p_fulfillment = 'pickup' then 0 else greatest(coalesce(p_delivery_minor, 0), 0) end,
    p_payment_method,
    -- 32 random bytes as hex (64 chars). Hex rather than base64 so the token is
    -- URL-safe with no escaping, which matters because it travels in a query
    -- string. Minted in the database so every caller gets the same construction.
    encode(extensions.gen_random_bytes(32), 'hex')
  )
  returning * into v_order;

  -- Snapshot each line and take its stock, in one pass.
  for v_line in
    select ci.product_id, ci.quantity, p.title, p.sku, p.slug,
           p.price_minor, p.currency, p.availability
      from public.cart_items ci
      join public.products p on p.id = ci.product_id
     where ci.cart_id = p_cart_id
     order by ci.created_at
  loop
    v_line_count := v_line_count + 1;

    if v_line.availability not in ('in_stock', 'preorder', 'backorder') then
      raise exception 'Product % is no longer purchasable', v_line.slug
        using errcode = 'check_violation';
    end if;

    -- The oversell guard. A conditional update: it only matches when enough
    -- stock remains, so two concurrent orders for the last unit cannot both
    -- succeed. `get diagnostics` reports whether it matched.
    update public.products
       set stock = stock - v_line.quantity
     where id = v_line.product_id
       and stock >= v_line.quantity;

    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'Insufficient stock for %', v_line.slug
        using errcode = 'check_violation';
    end if;

    -- Record the movement so the stock change is explainable after the fact.
    insert into public.inventory_movements (
      product_id, delta, reason, note, stock_after
    )
    select v_line.product_id, -v_line.quantity, 'sale',
           'Order ' || v_order.reference, p.stock
      from public.products p
     where p.id = v_line.product_id;

    -- The line price is the catalogue price read here, never a client value.
    insert into public.order_items (
      order_id, product_id, title, sku, slug, quantity, unit_price_minor, currency
    ) values (
      v_order.id, v_line.product_id, v_line.title, v_line.sku, v_line.slug,
      v_line.quantity, v_line.price_minor, v_line.currency
    );

    v_subtotal := v_subtotal + (v_line.price_minor * v_line.quantity);
  end loop;

  if v_line_count = 0 then
    raise exception 'Cart is empty'
      using errcode = 'check_violation';
  end if;

  -- Set totals explicitly rather than relying on the sync trigger, because the
  -- tampering guard skips orders with no lines at insert time.
  update public.orders
     set subtotal_minor = v_subtotal,
         total_minor = v_subtotal + v_order.delivery_minor,
         inventory_applied = true
   where id = v_order.id
  returning * into v_order;

  -- The cart is now converted, so it cannot be checked out twice.
  update public.carts set status = 'converted' where id = p_cart_id;

  insert into public.order_events (
    order_id, event_type, actor_kind, to_status, metadata
  ) values (
    v_order.id, 'order_placed', 'customer', 'pending_payment',
    jsonb_build_object('item_count', v_line_count, 'payment_method', p_payment_method)
  );

  return v_order;
end;
$$;
comment on function public.place_order is
  'Creates an order from a cart in one transaction: snapshots lines at catalogue prices, takes stock conditionally (no oversell), computes totals. Idempotent on p_idempotency_key. Every parameter is optional at the call site so PostgREST can resolve the function by name.';
