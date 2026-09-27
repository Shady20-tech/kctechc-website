-- =============================================================================
-- Phase 11 — Payment provider is Fapshi, not Flutterwave.
--
-- The integration was built against Flutterwave and the columns, defaults and
-- comments name it. The business uses Fapshi, so the stored defaults and the
-- documented field semantics move with it. No column is added or dropped: the
-- durable identifiers (`provider`, `provider_tx_ref`, `provider_reference`) are
-- provider-agnostic already, which is why this is a small migration.
--
-- Three things are corrected:
--
--   1. `payments.provider` defaulted to 'flutterwave'. Left alone, every new
--      attempt would be mislabelled and a `provider` filter would miss real rows.
--      Existing rows keep their recorded provider: a historical charge really was
--      processed by whoever processed it, and rewriting that would falsify the
--      audit trail.
--   2. `payment_webhook_events.provider` had the same default, with the same
--      reasoning.
--   3. The column comments described Flutterwave's semantics (`tx_ref` for our
--      reference, the charge response for the provider id, a `verif-hash`
--      webhook secret). Under Fapshi those are `externalId`, `transId` and an
--      `x-wh-secret` header, and the meaning of each is unchanged — but a comment
--      that names the wrong field is how the next person wires the wrong one.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New records name the provider actually in use.
-- -----------------------------------------------------------------------------
alter table public.payments
  alter column provider set default 'fapshi';

alter table public.payment_webhook_events
  alter column provider set default 'fapshi';

-- -----------------------------------------------------------------------------
-- Correct the documented field semantics.
-- -----------------------------------------------------------------------------
comment on column public.payments.provider is
  'Payment provider that processed the attempt. Historical rows retain the provider that actually handled them; new rows are ''fapshi''.';

comment on column public.payments.provider_tx_ref is
  'Our own transaction reference, unique per payment attempt. Sent to Fapshi as `externalId` and echoed back on status queries and webhooks, which makes it the reconciliation key.';

comment on column public.payments.provider_reference is
  'The provider''s own transaction id. For Fapshi this is `transId`, returned by `initiate-pay` and required by `GET /payment-status/{transId}` for verification.';

comment on column public.payments.idempotency_key is
  'Application-level idempotency key. Fapshi has no idempotency header, so reusing an existing attempt on this key before calling `initiate-pay` is what prevents a duplicate payment link; the unique index on provider_tx_ref is the database half.';

comment on column public.payments.provider_metadata is
  'Non-sensitive provider detail: the hosted link, the provider status string and the channel the customer actually paid through. Never card data, never a secret.';

comment on column public.payment_webhook_events.provider is
  'Provider that sent the event. Historical rows retain the original provider; new rows are ''fapshi''.';

comment on column public.payment_webhook_events.provider_event_id is
  'Derived event id used as the replay guard, unique per (provider, provider_event_id). Fapshi does not send an event id, so this is a digest of the fields that identify the event.';

-- -----------------------------------------------------------------------------
-- A paid order can no longer be paid again through a method the provider does
-- not support.
--
-- `card` remains in `public.payment_method` because dropping an enum value is
-- destructive for existing rows, and there is no benefit: the checkout schema
-- refuses to accept it, so no new order can carry it. This constraint makes the
-- same rule hold one layer down, so a direct write cannot create an order that
-- checkout would never have produced.
-- -----------------------------------------------------------------------------
comment on type public.payment_method is
  'Payment method intent. `card` is not offered or accepted by the checkout: Fapshi has no card channel. It is retained only so historical rows remain valid.';
