-- =============================================================================
-- Admin console support.
--
-- Three things the admin/customer surfaces need that the earlier phases did not
-- yet declare:
--
--   1. Public Storage buckets for product, property and avatar images. The
--      application already derives URLs for `product-media` and `property-media`
--      (`src/lib/store/storage.ts`, `src/lib/real-estate/storage.ts`) but the
--      buckets themselves were only ever declared in `supabase/config.toml`,
--      which is local-dev tooling. A production project would therefore start
--      with no bucket and every upload would fail. Declaring them here makes the
--      bucket part of the schema, so every environment — local, CI, production —
--      converges on the same configuration.
--
--   2. `avatars`, a public bucket for profile pictures.
--
--   3. `customer_transactions`, a per-customer payment history the account area
--      can render without the application reassembling order and payment rows.
--
-- All three buckets are PUBLIC. That is a deliberate, narrow decision: they hold
-- marketing imagery and a user's chosen profile picture, all of which are meant
-- to be displayed. Nothing private is placed in them. A visitor's inquiry
-- attachments stay in the separate private bucket created in
-- `20260101000013_electrical_projects.sql`, which is unaffected by this file.
--
-- Object writes are performed with the service-role client from Server Actions
-- after the caller has been authorized in the application, so no storage.objects
-- policy is defined here — matching how `project-media` already works. The
-- bucket-level `allowed_mime_types` and `file_size_limit` below are the second
-- line of defence: even a caller that bypassed the application cannot store a
-- type or a size outside these limits.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Buckets.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-media',
    'product-media',
    true,
    5242880, -- 5 MiB
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'property-media',
    'property-media',
    true,
    10485760, -- 10 MiB; property photography is larger than a product shot
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'avatars',
    'avatars',
    true,
    2097152, -- 2 MiB; a profile picture is displayed small
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'content-media',
    'content-media',
    true,
    5242880, -- 5 MiB; article cover images
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Customer transaction history.
--
-- One row per payment against an order the caller owns, plus the grand total of
-- the order so a partial payment is legible against what was owed.
--
-- `security_invoker` is essential: the views must run with the caller's rights so
-- the `orders_select_own` / `payments_select_own` policies continue to apply.
-- Without it the view would read everything, which for a financial history is
-- the worst possible failure.
-- -----------------------------------------------------------------------------
create or replace view public.customer_transactions
with (security_invoker = true)
as
select
  p.id                        as payment_id,
  o.id                        as order_id,
  o.reference                 as order_reference,
  o.status                    as order_status,
  p.status                    as payment_status,
  p.method                    as payment_method,
  p.amount_minor,
  p.refunded_minor,
  p.currency,
  o.total_minor               as order_total_minor,
  p.captured_at,
  p.refunded_at,
  p.created_at,
  o.customer_id
from public.payments p
join public.orders o on o.id = p.order_id;

comment on view public.customer_transactions is
  'Per-customer payment history for the account area. security_invoker, so the orders/payments owner policies still gate every row.';

-- Production has no `anon` grant for these rows by default; the customer must be
-- signed in. Revoke the implicit public grant and hand it to `authenticated`
-- only, so an anonymous key cannot read the payment ledger.
revoke all on public.customer_transactions from anon;
grant select on public.customer_transactions to authenticated;
