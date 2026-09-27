-- =============================================================================
-- Phase 8 — Order and payment enums
--
-- Enums live in their own migration because PostgreSQL will not let a new enum
-- value be *used* in the same transaction that adds it, and Supabase runs each
-- migration file in a single transaction. The tables that reference these values
-- live in the following migration. This mirrors the store enums in migration 10.
-- =============================================================================

-- Order lifecycle.
--
-- `pending_payment` is the only non-terminal state an order is *created* in.
-- There is deliberately no `draft`: an order row only exists once the customer
-- has committed to checkout, because a half-built cart is already represented by
-- `carts`. A row here is a commitment, not a work in progress.
--
-- `paid` is reachable only by a verified provider confirmation or an explicit
-- staff action; nothing in the application can move an order into it from a
-- client request. `fulfilled` is separate from `paid` because taking money and
-- delivering goods are different facts that a report must be able to separate.
create type public.order_status as enum (
  'pending_payment',
  'paid',
  'processing',
  'fulfilled',
  'cancelled',
  'refunded'
);

-- Payment lifecycle, tracked per attempt rather than per order.
--
-- `requires_action` exists for mobile money: MTN/Orange return a pending state
-- while the customer approves on their handset, which is neither a success nor a
-- failure and must not be reported as either.
--
-- `manual_pending` is the honest state for a bank transfer. The business has
-- been told to expect money; nothing has confirmed it arrived. Reconciliation is
-- a human act, and no code path may move an order to `paid` from this state
-- automatically.
create type public.payment_status as enum (
  'pending',
  'requires_action',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
  'manual_pending'
);

-- How the customer chose to pay. Narrowed to what the business can actually
-- settle in Cameroon; a generic "other" would let an unsettleable method be
-- recorded and silently never reconciled.
create type public.payment_method as enum (
  'card',
  'mobile_money_mtn',
  'mobile_money_orange',
  'bank_transfer'
);

-- How the order reaches the customer. A physical-goods store needs both, and
-- defaulting to delivery would invent an address requirement for a pickup order.
create type public.order_fulfillment as enum (
  'delivery',
  'pickup'
);

-- Why an order's status changed. Mirrors `inquiry_events` rather than an enum,
-- because the set grows with integration detail (webhook, staff, expiry) and an
-- enum would force a migration for each new actor.
comment on type public.order_status is
  'Order lifecycle. paid is reachable only from a verified provider confirmation or explicit staff action.';

comment on type public.payment_status is
  'Per-attempt payment lifecycle. manual_pending means awaiting human reconciliation, never auto-paid.';

-- =============================================================================
-- CRM triage enums
--
-- Added here rather than in the CRM migration for the same
-- one-transaction-per-file reason: `20260101000035_crm_and_reports.sql` uses
-- these values in column defaults, which is not permitted in the transaction
-- that creates them.
-- =============================================================================

-- Priority as an enum rather than an integer, so a report cannot fragment on
-- someone typing 3 versus "high", and so an unset priority is never confused
-- with a deliberately normal one.
create type public.inquiry_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

-- What the visitor wanted. Deliberately overlapping with `inquiry_source` but
-- not identical: source is the funnel the form belongs to, type is the intent.
-- A corporate contact form and a service page can both produce a quote request.
create type public.inquiry_type as enum (
  'general',
  'quote',
  'property',
  'viewing',
  'service',
  'support'
);

comment on type public.inquiry_priority is
  'CRM triage priority. Drives inbox ordering; never inferred from content.';
comment on type public.inquiry_type is
  'Visitor intent, distinct from inquiry_source which records the funnel.';
