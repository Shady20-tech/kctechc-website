-- =============================================================================
-- Phase 8 — Orders, order items and payments
--
-- The transactional core. Three principles drive the shape:
--
--   1. **Money is server-authoritative.** Every total on `orders` is computed
--      from the line rows by a trigger, never accepted from the client. A
--      client-submitted total is not evidence of anything.
--   2. **An order is immutable once placed.** Line rows snapshot the title, sku
--      and unit price at purchase time. A later product edit or price change
--      must not rewrite what the customer bought or what they were charged.
--   3. **Paid is a fact, not a request.** `paid` is only reached through the
--      confirming functions below, which are only called by the webhook handler
--      (after signature verification) or by staff. No RLS policy grants a
--      customer the ability to set order status.
--
-- Customer PII lives on `orders` only, matching the conventions set by
-- `inquiries`. Nothing here stores card data: `payments` holds provider tokens
-- and references, never a PAN, CVV or expiry.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  reference text not null unique,
  status public.order_status not null default 'pending_payment',

  -- The visitor who placed it, when signed in. Null for a guest order: forcing
  -- an account before purchase is a conversion cost the business did not ask for.
  customer_id uuid references auth.users (id) on delete set null,
  -- Email is duplicated off `profiles` deliberately: the order is a business
  -- record and must survive the account being deleted, which
  -- `on delete set null` above allows.
  email extensions.citext not null,
  full_name text not null,
  phone text,

  locale public.locale_code not null default 'en',
  currency text not null default 'XAF',

  fulfillment public.order_fulfillment not null default 'delivery',
  -- Delivery address. Nullable because a pickup order has none, and inventing
  -- one would put a fictional address on a real order. The check below ties the
  -- requirement to the fulfillment method.
  delivery_address_line1 text,
  delivery_address_line2 text,
  delivery_city text,
  delivery_region_id uuid references public.regions (id) on delete set null,
  delivery_notes text,

  -- The cart this order was created from, for attribution and for marking the
  -- cart converted. Kept nullable so an order placed by staff on a customer's
  -- behalf has no cart.
  cart_id uuid references public.carts (id) on delete set null,

  -- Totals, in minor units. All are trigger-maintained from `order_items`; a
  -- direct UPDATE to them is rejected by `orders_protect_totals`.
  subtotal_minor integer not null default 0,
  delivery_minor integer not null default 0,
  total_minor integer not null default 0,

  -- Payment rollup, denormalized for fast reporting. The authoritative history
  -- is `payments`; these mirror the latest attempt and are maintained by
  -- `apply_payment_result`.
  paid_minor integer not null default 0,
  payment_method public.payment_method,

  -- Idempotency for the whole checkout submission. A double-submitted checkout
  -- (impatient click, retried request) must not create two orders, so the client
  -- sends a key and a unique index makes the second insert a no-op.
  idempotency_key text not null,

  placed_at timestamptz not null default now(),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,

  -- Set when the customer requested a bank transfer and the business must act.
  manual_payment_reference text,

  -- Unguessable token authorizing a *guest* to view this order.
  --
  -- The human-readable reference is `KC-ORD-YYYYMMDD-XXXXXX` — six characters
  -- from a 32-symbol alphabet, roughly 10^9 values on a known date. That is a
  -- fine thing to read down a phone but a poor bearer credential, because a
  -- reference is enumerable and is also printed on receipts. This token is 256
  -- bits of randomness and is what the confirmation and history URLs carry for a
  -- visitor with no account. A signed-in customer is matched on `customer_id`
  -- instead and never needs the token.
  access_token text not null,

  -- Inventory accounting. Stock is decremented when the order is placed (a
  -- pending order still holds its goods, so two customers cannot both buy the
  -- last unit) and returned if the order is cancelled. These flags make both
  -- operations idempotent: a retried call must not decrement or restore twice.
  inventory_applied boolean not null default false,
  inventory_released_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_reference_format check (
    reference ~ '^KC-ORD-[0-9]{8}-[A-Z0-9]{6}$'
  ),
  constraint orders_access_token_length check (
    char_length(access_token) between 32 and 128
  ),
  constraint orders_email_length check (char_length(email::text) <= 254),
  constraint orders_name_length check (char_length(full_name) between 1 and 200),
  constraint orders_phone_length check (
    phone is null or char_length(phone) <= 40
  ),
  constraint orders_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint orders_subtotal_non_negative check (subtotal_minor >= 0),
  constraint orders_delivery_non_negative check (delivery_minor >= 0),
  constraint orders_total_non_negative check (total_minor >= 0),
  constraint orders_paid_non_negative check (paid_minor >= 0),
  constraint orders_idempotency_length check (
    char_length(idempotency_key) between 8 and 128
  ),

  -- A delivery order must carry a complete-enough address to actually deliver:
  -- street line and city. Without this, a delivery order can be created that
  -- nobody can fulfil, and the gap is only discovered after payment.
  constraint orders_delivery_requires_address check (
    fulfillment <> 'delivery'
    or (
      delivery_address_line1 is not null
      and char_length(delivery_address_line1) between 1 and 200
      and delivery_city is not null
      and char_length(delivery_city) between 1 and 120
    )
  ),
  -- The delivery fee is only meaningful for a delivery order.
  constraint orders_pickup_no_delivery_fee check (
    fulfillment <> 'pickup' or delivery_minor = 0
  ),

  -- Timestamps must agree with the status, so a report cannot find a `paid`
  -- order with no `paid_at`. This is the invariant that makes the state machine
  -- auditable rather than merely conventional.
  constraint orders_status_timestamps check (
    (status <> 'paid' or paid_at is not null)
    and (status <> 'fulfilled' or fulfilled_at is not null)
    and (status <> 'cancelled' or cancelled_at is not null)
    and (status <> 'refunded' or refunded_at is not null)
  ),
  -- A refunded order was necessarily paid first.
  constraint orders_refund_requires_payment check (
    status <> 'refunded' or paid_at is not null
  )
);

comment on table public.orders is
  'Placed orders. Totals are trigger-maintained from order_items and are server-authoritative.';
comment on column public.orders.idempotency_key is
  'Client-supplied key making checkout submission idempotent. Unique per order.';
comment on column public.orders.manual_payment_reference is
  'Bank-transfer reference the customer was given. Never implies the money arrived.';

-- One order per idempotency key, scoped to the customer.
--
-- Two partial indexes rather than one expression index: a signed-in customer is
-- keyed by `customer_id`, a guest by `email`. Scoping this way stops two
-- unrelated guests colliding on a coincidental key, and stops a customer reusing
-- a key to probe for someone else's order.
create unique index orders_idempotency_customer_idx
  on public.orders (idempotency_key, customer_id)
  where customer_id is not null;
create unique index orders_idempotency_email_idx
  on public.orders (idempotency_key, email)
  where customer_id is null;

create index orders_customer_idx
  on public.orders (customer_id, placed_at desc)
  where customer_id is not null;
create index orders_email_idx
  on public.orders (email, placed_at desc);
create index orders_status_idx
  on public.orders (status, placed_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Order items
--
-- Snapshots, not references. `title`, `sku` and `unit_price_minor` are copied at
-- purchase time so the order remains a truthful record after the catalogue
-- changes. `product_id` is kept (nullable) for reporting and returns.
-- -----------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,

  -- Snapshot of what was bought.
  title text not null,
  sku text not null,
  slug text not null,
  quantity integer not null,
  unit_price_minor integer not null,
  currency text not null default 'XAF',
  -- unit_price_minor * quantity, materialized so a report never has to multiply
  -- and cannot disagree with the line it is reporting on.
  line_total_minor integer generated always as (unit_price_minor * quantity) stored,

  created_at timestamptz not null default now(),

  constraint order_items_quantity_positive check (quantity > 0 and quantity <= 999),
  constraint order_items_price_non_negative check (unit_price_minor >= 0),
  constraint order_items_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint order_items_title_length check (char_length(title) between 1 and 200)
);

comment on table public.order_items is
  'Order line snapshots. Title, sku and price are captured at purchase time and never rewritten.';

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx
  on public.order_items (product_id)
  where product_id is not null;

-- -----------------------------------------------------------------------------
-- Payments
--
-- One row per attempt. An order may have several (a failed card, then a
-- successful mobile-money approval), and each is recorded rather than
-- overwriting the last, because a disputed charge needs the attempt history.
--
-- No card data, ever. `provider_reference` is the provider's own id;
-- `provider_tx_ref` is ours. Field names follow Flutterwave's current API.
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.payment_status not null default 'pending',
  method public.payment_method not null,
  provider text not null default 'flutterwave',

  amount_minor integer not null,
  currency text not null default 'XAF',

  -- Our reference, sent to the provider as `tx_ref`. Unique so a retry cannot
  -- create two charges for one payment intent.
  provider_tx_ref text not null unique,
  -- The provider's own transaction id, from the charge response or the webhook.
  provider_reference text,
  -- Idempotency key sent to the provider on charge creation, so a retried
  -- network call returns the original charge rather than making a second one.
  idempotency_key text not null,

  -- Free-form, non-sensitive provider detail (status string, processor). Never
  -- card data, never a secret. A raw provider payload is stored on
  -- `payment_webhook_events` instead, which is the right place for it.
  provider_metadata jsonb not null default '{}'::jsonb,

  failure_reason text,
  -- Set when a refund is recorded. The amount actually returned.
  refunded_minor integer not null default 0,

  authorized_at timestamptz,
  captured_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_amount_positive check (amount_minor > 0),
  constraint payments_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint payments_tx_ref_length check (
    char_length(provider_tx_ref) between 8 and 128
  ),
  constraint payments_idempotency_length check (
    char_length(idempotency_key) between 8 and 128
  ),
  constraint payments_refunded_non_negative check (refunded_minor >= 0),
  constraint payments_refund_not_over_amount check (refunded_minor <= amount_minor),
  constraint payments_metadata_is_object check (
    jsonb_typeof(provider_metadata) = 'object'
  ),
  -- Bank transfer is the only method that may sit in manual_pending; a card in
  -- that state means a reconciliation was skipped.
  constraint payments_manual_pending_is_bank_transfer check (
    status <> 'manual_pending' or method = 'bank_transfer'
  ),
  constraint payments_failure_reason_length check (
    failure_reason is null or char_length(failure_reason) between 1 and 500
  )
);

comment on table public.payments is
  'Per-attempt payment records. Holds provider references only; never card data.';
comment on column public.payments.idempotency_key is
  'Idempotency key sent to the provider when creating the charge.';

create index payments_order_idx on public.payments (order_id, created_at desc);
create index payments_status_idx on public.payments (status, created_at desc);
create index payments_provider_reference_idx
  on public.payments (provider_reference)
  where provider_reference is not null;

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Order events — append-only status timeline.
--
-- Mirrors `inquiry_events`. Every transition names its actor so an order marked
-- paid can be traced to the webhook or the staff member that did it.
-- -----------------------------------------------------------------------------
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  -- 'customer', 'staff', 'webhook', 'system'. Free text with a check rather than
  -- an enum, so a new integration actor does not need a migration.
  actor_kind text not null default 'system',
  from_status public.order_status,
  to_status public.order_status,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint order_events_type_format check (event_type ~ '^[a-z][a-z0-9_]*$'),
  constraint order_events_actor_kind check (
    actor_kind in ('customer', 'staff', 'webhook', 'system')
  ),
  constraint order_events_metadata_is_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint order_events_note_length check (
    note is null or char_length(note) between 1 and 1000
  )
);

comment on table public.order_events is
  'Append-only order timeline. Rows are never updated or deleted.';

create index order_events_order_idx
  on public.order_events (order_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Payment webhook events — the replay-protection ledger.
--
-- One row per delivered webhook. `provider_event_id` is unique, so a replayed
-- delivery (which every provider does, deliberately, as an at-least-once
-- guarantee) inserts nothing the second time and the handler detects it.
--
-- The raw body is stored because signature verification happens over the exact
-- bytes received; keeping it means a disputed event can be re-verified and a
-- signature bug diagnosed. It contains no card data — a Flutterwave webhook
-- carries ids, amounts and status.
-- -----------------------------------------------------------------------------
create table public.payment_webhook_events (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null default 'flutterwave',
  -- The provider's event id. Unique: this is the replay guard.
  provider_event_id text not null,
  event_type text,
  provider_tx_ref text,
  signature_valid boolean not null default false,
  -- Whether the event was acted on or recognized as a duplicate/irrelevant
  -- delivery, so an operator can explain why an event changed nothing.
  processed boolean not null default false,
  process_note text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),

  constraint payment_webhook_events_metadata_is_object check (
    jsonb_typeof(payload) = 'object'
  ),
  constraint payment_webhook_events_type_length check (
    event_type is null or char_length(event_type) between 1 and 120
  ),
  constraint payment_webhook_events_note_length check (
    process_note is null or char_length(process_note) between 1 and 500
  )
);

comment on table public.payment_webhook_events is
  'Webhook ledger. provider_event_id is unique, which is what makes replay a no-op.';

-- Unique on (provider, event id): the same provider cannot deliver one event
-- twice, and two providers cannot shadow each other's ids.
create unique index payment_webhook_events_unique_idx
  on public.payment_webhook_events (provider, provider_event_id);
create index payment_webhook_events_tx_ref_idx
  on public.payment_webhook_events (provider_tx_ref)
  where provider_tx_ref is not null;
create index payment_webhook_events_received_idx
  on public.payment_webhook_events (received_at desc);
