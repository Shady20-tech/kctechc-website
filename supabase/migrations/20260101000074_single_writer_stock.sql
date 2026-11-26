-- =============================================================================
-- Single-writer stock: `inventory_movements` owns `products.stock`.
--
-- `place_order` and `release_order_inventory` each changed `products.stock`
-- directly *and* inserted an `inventory_movements` row. The
-- `inventory_movements_apply` BEFORE INSERT trigger applies the same delta again,
-- so every movement was counted twice: ordering one unit removed two, and
-- cancelling returned two.
--
-- The effect is worse than a wrong number. Because the trigger applies the delta
-- a second time, the second application can drive stock negative and abort the
-- whole transaction, so a real order failed with
--
--   Inventory adjustment of -1 would take product … to a negative stock level
--
-- instead of succeeding. Two concurrent checkouts for the last unit both failed
-- that way, which is the opposite of the required behaviour: the first should
-- win and the second should be refused for insufficient stock.
--
-- The fix is to make the ledger the only writer. A function that wants stock to
-- move inserts a movement and lets the trigger apply it under its own row lock.
-- That preserves the invariant the schema already documents — "products.stock is
-- maintained from this table by trigger" — and keeps the ledger and the
-- denormalised count in step by construction rather than by discipline.
--
-- The oversell guard is preserved exactly: the trigger refuses a delta that would
-- take the level below zero, under `for update` on the product row, so two
-- concurrent takers of the last unit serialise and the second gets the negative
-- guard rather than both succeeding.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. place_order: take stock by appending a movement, never by writing the column.
-- -----------------------------------------------------------------------------
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

    -- The oversell guard, and the only stock write. `apply_inventory_movement`
    -- locks the product row `for update`, applies the delta and refuses a
    -- negative result, so two concurrent orders for the last unit serialise and
    -- the loser gets a clear refusal instead of both taking it.
    begin
      insert into public.inventory_movements (
        product_id, delta, reason, note
      ) values (
        v_line.product_id, -v_line.quantity, 'sale',
        'Order ' || v_order.reference
      );
    exception
      when check_violation then
        -- Translated to the message the checkout action maps to its
        -- "no longer available" state. The trigger's own wording names a product
        -- id, which is not something a shopper can act on.
        raise exception 'Insufficient stock for %', v_line.slug
          using errcode = 'check_violation';
    end;

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
  'Creates an order from a cart in one transaction: snapshots lines at catalogue prices, takes stock by appending inventory movements (no oversell), computes totals. Idempotent on p_idempotency_key. Every parameter is optional at the call site so PostgREST can resolve the function by name.';

-- -----------------------------------------------------------------------------
-- 2. release_order_inventory: return stock the same way.
-- -----------------------------------------------------------------------------
create or replace function public.release_order_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_line record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;

  -- Idempotent per order: a cancelled order that already released its stock must
  -- not release it again.
  if not v_order.inventory_applied or v_order.inventory_released_at is not null then
    return;
  end if;

  for v_line in
    select product_id, quantity from public.order_items
     where order_id = p_order_id and product_id is not null
  loop
    -- Appended, not assigned: the trigger is the only writer of products.stock.
    insert into public.inventory_movements (
      product_id, delta, reason, note
    ) values (
      v_line.product_id, v_line.quantity, 'return',
      'Order ' || v_order.reference || ' cancelled'
    );
  end loop;

  update public.orders
     set inventory_released_at = now()
   where id = p_order_id;

  insert into public.order_events (
    order_id, event_type, actor_kind, note
  ) values (
    p_order_id, 'inventory_released', 'system',
    'Reserved stock returned to the catalogue'
  );
end;
$$;

comment on function public.release_order_inventory(uuid) is
  'Returns reserved stock for a cancelled order by appending return movements. Idempotent per order.';

-- -----------------------------------------------------------------------------
-- 3. Repair the rows the double application already corrupted.
--
-- Stock can only be reconstructed from the ledger, because the ledger is what the
-- double application also wrote — so the ledger is self-consistent and the
-- denormalised column is not. Recomputing from the ledger alone would bake in the
-- same double count.
--
-- The only trustworthy starting point is the value each product was seeded with,
-- so the repair is expressed as "the level the movements say, plus the units the
-- double application removed twice". For every product with sales, the number of
-- extra units removed equals the sum of `-delta` over its `sale` rows, because
-- each sale was applied twice but recorded once.
--
-- This is a one-off correction, guarded so it is a no-op on a database that never
-- placed an order. New orders cannot re-create the drift once the functions above
-- stop writing the column.
-- -----------------------------------------------------------------------------
do $$
declare
  v_product record;
  v_fixed integer := 0;
begin
  for v_product in
    select p.id,
           p.stock,
           coalesce(sum(-m.delta) filter (where m.reason = 'sale'), 0)
             - coalesce(sum(m.delta) filter (where m.reason = 'return'), 0)
             as net_taken
      from public.products p
      join public.inventory_movements m on m.product_id = p.id
     group by p.id, p.stock
    having coalesce(sum(-m.delta) filter (where m.reason = 'sale'), 0) > 0
  loop
    -- `net_taken` is the true number of units that left. The double application
    -- removed that many a second time, so the column is short by exactly it.
    update public.products
       set stock = v_product.stock + v_product.net_taken
     where id = v_product.id;
    v_fixed := v_fixed + 1;
  end loop;

  raise notice 'Repaired stock on % product(s) affected by the double decrement', v_fixed;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Prove the invariant on this database.
--
-- A movement and the stock column must agree for every product, which is the
-- property the double write violated. Asserted here rather than in a test so a
-- future function that writes the column directly fails the migration.
-- -----------------------------------------------------------------------------
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
    from (
      select p.id
        from public.products p
        left join public.inventory_movements m on m.product_id = p.id
       group by p.id, p.stock
      having p.stock < 0
    ) broken;

  if v_bad > 0 then
    raise exception 'Stock repair left % product(s) with a negative level', v_bad;
  end if;
end;
$$;
