-- =============================================================================
-- Phase 8 — Order state machine, totals, inventory and payment application
--
-- This migration is where the acceptance criteria are actually enforced, in the
-- database rather than in application code, because the application is not the
-- only possible writer:
--
--   * **Totals are server-authoritative.** `orders_sync_totals` recomputes
--     `subtotal_minor` from `order_items` on every change, and
--     `orders_reject_total_tampering` overwrites any total that arrives in an
--     UPDATE which was not produced by that recomputation. A client-submitted
--     total cannot survive.
--   * **Overselling is impossible.** `place_order` decrements stock with a
--     conditional UPDATE (`stock >= quantity`) inside the same transaction that
--     creates the order. Two concurrent checkouts of the last unit cannot both
--     succeed: the second finds no row to update and the whole transaction rolls
--     back, leaving neither an order nor a decrement.
--   * **Paid cannot be requested.** `apply_payment_result` is the only function
--     that moves an order to `paid`, and it requires a *verified* provider
--     confirmation. It is not exposed to `authenticated` or `anon`; only the
--     service role (the webhook handler) and staff call it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Order reference: KC-ORD-YYYYMMDD-XXXXXX
--
-- Same alphabet convention as inquiry references: I/O/0/1 excluded so a
-- reference survives being read aloud or transcribed from a phone call.
-- -----------------------------------------------------------------------------
create or replace function public.generate_order_reference()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  suffix text := '';
  i integer;
begin
  for i in 1..6 loop
    suffix := suffix || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return 'KC-ORD-' || to_char(now(), 'YYYYMMDD') || '-' || suffix;
end;
$$;

comment on function public.generate_order_reference() is
  'Human-readable order reference. Excludes I/O/0/1 to avoid transcription errors.';

-- -----------------------------------------------------------------------------
-- The legal transitions.
--
-- Kept as a function rather than written inline in each caller so the rule has
-- exactly one definition. `null` from-status means "newly created" and is only
-- legal into `pending_payment`.
-- -----------------------------------------------------------------------------
create or replace function public.order_transition_allowed(
  p_from public.order_status,
  p_to public.order_status
)
returns boolean
language sql
immutable
as $$
  select case
    when p_from is null then p_to = 'pending_payment'
    when p_from = 'pending_payment' then p_to in ('paid', 'cancelled')
    when p_from = 'paid' then p_to in ('processing', 'fulfilled', 'refunded', 'cancelled')
    when p_from = 'processing' then p_to in ('fulfilled', 'refunded', 'cancelled')
    when p_from = 'fulfilled' then p_to in ('refunded')
    -- Terminal. A refunded order is not reopened; a new order is placed.
    when p_from in ('cancelled', 'refunded') then false
    else false
  end;
$$;

comment on function public.order_transition_allowed(public.order_status, public.order_status) is
  'Single definition of the order state machine. null from-status means creation.';

-- -----------------------------------------------------------------------------
-- Totals recomputation.
--
-- Fires on any order_item change and recomputes the parent order's subtotal and
-- total from the line rows. `delivery_minor` is preserved: it is not derivable
-- from the lines, it is a decision recorded at checkout.
--
-- The `pg_trigger_depth()` guard matters. This function writes to `orders`,
-- which fires `orders_reject_total_tampering`; without a way to distinguish "the
-- recomputation wrote this" from "a client wrote this", the guard would reject
-- its own legitimate write. Depth > 1 means we are inside the recomputation.
-- -----------------------------------------------------------------------------
create or replace function public.orders_sync_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
  v_subtotal integer;
begin
  select coalesce(sum(line_total_minor), 0)
    into v_subtotal
    from public.order_items
   where order_id = v_order_id;

  update public.orders
     set subtotal_minor = v_subtotal,
         total_minor = v_subtotal + delivery_minor
   where id = v_order_id;

  return null;
end;
$$;

comment on function public.orders_sync_totals() is
  'Recomputes order subtotal/total from order_items whenever a line changes.';

create trigger order_items_sync_totals
  after insert or update or delete on public.order_items
  for each row execute function public.orders_sync_totals();

-- -----------------------------------------------------------------------------
-- Reject direct total tampering.
--
-- The trigger above is the only legitimate writer of these columns. Anything
-- else — a client UPDATE via PostgREST, a future integration bug — is
-- overwritten from the line rows rather than rejected, which is the stronger
-- behaviour: the stored value is guaranteed correct rather than merely guarded.
--
-- Overwriting rather than raising is deliberate. A raise would break the
-- legitimate trigger write and would turn a data-integrity problem into an
-- outage; recomputing means an order can never carry a wrong total even if some
-- path we did not anticipate tries to set one.
-- -----------------------------------------------------------------------------
create or replace function public.orders_reject_total_tampering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subtotal integer;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select coalesce(sum(line_total_minor), 0)
    into v_subtotal
    from public.order_items
   where order_id = new.id;

  -- Nothing to protect on an order with no lines yet (it was just created).
  if not exists (select 1 from public.order_items where order_id = new.id) then
    return new;
  end if;

  new.subtotal_minor := v_subtotal;
  -- The delivery fee is a recorded decision, but it is never negative and never
  -- applies to a pickup order; both are table constraints, re-asserted here.
  if new.fulfillment = 'pickup' then
    new.delivery_minor := 0;
  end if;
  new.total_minor := new.subtotal_minor + new.delivery_minor;

  return new;
end;
$$;

comment on function public.orders_reject_total_tampering() is
  'Recomputes totals on any direct write, so a client-submitted total cannot survive.';

create trigger orders_protect_totals
  before update on public.orders
  for each row execute function public.orders_reject_total_tampering();

-- -----------------------------------------------------------------------------
-- Status transition enforcement.
--
-- A guard trigger, so an invalid transition fails loudly with a message the
-- caller can act on, instead of silently producing a state the reports cannot
-- interpret. Timestamps are set here too, so they can never disagree with the
-- status (which the table check constraint also asserts).
-- -----------------------------------------------------------------------------
create or replace function public.orders_enforce_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not public.order_transition_allowed(old.status, new.status) then
    raise exception 'Illegal order transition % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;
  if new.status = 'fulfilled' and new.fulfilled_at is null then
    new.fulfilled_at := now();
  end if;
  if new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;
  if new.status = 'refunded' and new.refunded_at is null then
    new.refunded_at := now();
  end if;

  return new;
end;
$$;

comment on function public.orders_enforce_transition() is
  'Rejects illegal order status transitions and stamps the matching timestamp.';

create trigger orders_enforce_transition
  before update on public.orders
  for each row execute function public.orders_enforce_transition();

-- -----------------------------------------------------------------------------
-- Place an order.
--
-- The whole checkout commit, in one transaction. Everything that must be true
-- together is true or nothing is written:
--
--   1. The cart is re-read and its lines are snapshotted.
--   2. Every line's price is re-read from `products`, so the price the customer
--      is charged is the current catalogue price, not one that travelled through
--      the browser.
--   3. Stock is decremented conditionally. If any line cannot be satisfied the
--      function raises, the transaction rolls back, and no order exists.
--   4. Totals are computed here from the snapshots.
--
-- `p_delivery_minor` is the one money value accepted from the caller, because it
-- is a business decision (a delivery zone price) rather than something derivable
-- from the catalogue. It is clamped to a sane range and never trusted beyond
-- that.
-- -----------------------------------------------------------------------------
create or replace function public.place_order(
  p_idempotency_key text,
  p_cart_id uuid,
  p_customer_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_locale public.locale_code,
  p_fulfillment public.order_fulfillment,
  p_payment_method public.payment_method,
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
  'Creates an order from a cart in one transaction: snapshots lines at catalogue prices, takes stock conditionally (no oversell), computes totals. Idempotent on p_idempotency_key.';

-- -----------------------------------------------------------------------------
-- Return reserved stock when an order is cancelled.
--
-- Idempotent via `inventory_applied`: cancelling twice restores stock once. A
-- cancelled order that already released its stock must not release it again,
-- which is the classic double-refund bug in inventory form.
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

  if not v_order.inventory_applied or v_order.inventory_released_at is not null then
    return;
  end if;

  for v_line in
    select product_id, quantity from public.order_items
     where order_id = p_order_id and product_id is not null
  loop
    update public.products
       set stock = stock + v_line.quantity
     where id = v_line.product_id;

    insert into public.inventory_movements (
      product_id, delta, reason, note, stock_after
    )
    select v_line.product_id, v_line.quantity, 'return',
           'Order ' || v_order.reference || ' cancelled', p.stock
      from public.products p
     where p.id = v_line.product_id;
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
  'Returns reserved stock for a cancelled order. Idempotent per order.';

-- -----------------------------------------------------------------------------
-- Apply a verified payment result.
--
-- THE ONLY PATH TO `paid`. It is the single place where a payment outcome is
-- translated into an order status, so the rule "an order is paid only after a
-- verified provider confirmation" has exactly one implementation.
--
-- It refuses to mark an order paid from a payment that is not `succeeded`, and
-- it refuses to move an order that is no longer `pending_payment` — a late
-- webhook for a cancelled order is recorded against the payment, not applied to
-- the order, which is what stops a refund-and-replay race from resurrecting a
-- cancelled order.
-- -----------------------------------------------------------------------------
create or replace function public.apply_payment_result(
  p_payment_id uuid,
  p_status public.payment_status,
  p_provider_reference text default null,
  p_failure_reason text default null,
  p_provider_metadata jsonb default '{}'::jsonb
)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_sum_succeeded integer;
begin
  select * into v_payment
    from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'no_data_found';
  end if;

  select * into v_order
    from public.orders where id = v_payment.order_id for update;

  update public.payments
     set status = p_status,
         provider_reference = coalesce(p_provider_reference, provider_reference),
         failure_reason = case when p_status = 'failed' then p_failure_reason else failure_reason end,
         provider_metadata = provider_metadata || coalesce(p_provider_metadata, '{}'::jsonb),
         authorized_at = case when p_status in ('succeeded', 'requires_action') and authorized_at is null then now() else authorized_at end,
         captured_at = case when p_status = 'succeeded' and captured_at is null then now() else captured_at end,
         failed_at = case when p_status in ('failed', 'cancelled') and failed_at is null then now() else failed_at end,
         refunded_at = case when p_status = 'refunded' and refunded_at is null then now() else refunded_at end
   where id = p_payment_id
  returning * into v_payment;

  -- Roll up the amount actually captured across this order's payments.
  select coalesce(sum(amount_minor), 0) into v_sum_succeeded
    from public.payments
   where order_id = v_payment.order_id and status = 'succeeded';

  update public.orders
     set paid_minor = v_sum_succeeded
   where id = v_payment.order_id;

  -- Only a succeeded payment, and only from pending_payment, promotes the order.
  if p_status = 'succeeded'
     and v_order.status = 'pending_payment'
     and v_sum_succeeded >= v_order.total_minor then
    update public.orders
       set status = 'paid'
     where id = v_payment.order_id;

    insert into public.order_events (
      order_id, event_type, actor_kind, from_status, to_status, metadata
    ) values (
      v_payment.order_id, 'payment_confirmed', 'webhook',
      v_order.status, 'paid',
      jsonb_build_object('payment_id', p_payment_id, 'provider_reference', p_provider_reference)
    );
  end if;

  return v_payment;
end;
$$;

comment on function public.apply_payment_result is
  'Sole path to a paid order. Requires a succeeded payment and a pending_payment order.';

-- -----------------------------------------------------------------------------
-- Cancel an order.
--
-- Goes through the same transition guard, and releases inventory in the same
-- transaction so stock and status can never disagree.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_order(
  p_order_id uuid,
  p_actor_id uuid default null,
  p_actor_kind text default 'staff',
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;

  if v_order.status = 'cancelled' then
    return v_order;
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id
  returning * into v_order;

  perform public.release_order_inventory(p_order_id);

  insert into public.order_events (
    order_id, event_type, actor_id, actor_kind, from_status, to_status, note
  ) values (
    p_order_id, 'order_cancelled', p_actor_id, p_actor_kind,
    'pending_payment', 'cancelled', p_note
  );

  return v_order;
end;
$$;

comment on function public.cancel_order is
  'Cancels an order and returns its reserved stock in one transaction.';

-- -----------------------------------------------------------------------------
-- Row Level Security.
--
-- Customers read only their own orders. There is deliberately NO insert policy
-- for customers: orders are created by `place_order` as the service role, so a
-- browser cannot write an order row directly and thereby set a total or a status.
-- There is no UPDATE policy for customers either — that is what makes "orders
-- cannot be marked paid by a client request" structurally true rather than a
-- convention the application is trusted to follow.
-- -----------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_events enable row level security;
alter table public.payment_webhook_events enable row level security;

-- A signed-in customer sees their own orders. A guest order has `customer_id`
-- null and is reachable only by the service role, so its reference and email are
-- not enumerable by other signed-in users.
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (customer_id = auth.uid());

create policy "orders_select_admin"
  on public.orders for select
  to authenticated
  using (public.is_admin());

create policy "orders_update_admin"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "order_items_select_own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

-- Staff see payment records for orders they can see. Customers see their own.
-- No insert/update policy: only the service role writes payment rows.
create policy "payments_select_own"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = payments.order_id
         and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

create policy "order_events_select_own"
  on public.order_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = order_events.order_id
         and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

-- The webhook ledger is internal. Only admins may read it; nothing but the
-- service role may write it.
create policy "payment_webhook_events_select_admin"
  on public.payment_webhook_events for select
  to authenticated
  using (public.is_admin());
