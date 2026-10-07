-- =============================================================================
-- Payment records are manual again.
--
-- The site no longer integrates a payment provider. Migration 39 pointed the
-- `provider` defaults at 'fapshi' and documented the columns in Fapshi's terms;
-- both are now wrong and misleading, so they are corrected here.
--
-- No column is added or dropped — the identifiers were always
-- provider-agnostic, which is why removing the provider is a small migration:
--
--   1. `payments.provider` and `payment_webhook_events.provider` default to
--      'fapshi'. A new payment is now recorded by a staff member confirming a
--      received transfer or mobile-money payment, so the correct default is
--      'manual'. Historical rows keep the provider that actually handled them;
--      rewriting that would falsify the audit trail.
--   2. The column comments described Fapshi's `externalId` / `transId` /
--      `x-wh-secret`. A comment that names a removed provider is how the next
--      person concludes the integration still exists.
--
-- The provider may still hold 'fapshi' on rows written while that integration
-- was live; those are historical facts and are left untouched.
-- =============================================================================

alter table public.payments
  alter column provider set default 'manual';

alter table public.payment_webhook_events
  alter column provider set default 'manual';

comment on column public.payments.provider is
  'How the payment was recorded. ''manual'' means a staff member confirmed it (bank transfer or mobile money) and is the only value new rows use; historical rows may name the removed provider that handled them.';

comment on column public.payments.provider_tx_ref is
  'Our own transaction reference, unique per payment. The reconciliation key; for a manual payment it is derived from the order reference.';

comment on column public.payments.provider_reference is
  'The provider''s own transaction id, when a provider supplied one. Null for a manual payment recorded by staff.';

comment on column public.payments.idempotency_key is
  'Application-level idempotency key. The unique index on this key (and on provider_tx_ref) is what makes recording the same payment twice a no-op rather than a duplicate row.';

comment on column public.payments.provider_metadata is
  'Non-sensitive detail about how the payment was recorded: who confirmed it, and any reference the customer supplied. Never card data, never a secret.';

comment on column public.payment_webhook_events.provider is
  'Provider that sent the event. Historical rows retain the original provider. No provider webhooks are configured: this table is retained for audit history only.';

comment on column public.payment_webhook_events.provider_event_id is
  'Derived event id used as the replay guard, unique per (provider, provider_event_id). Retained for audit history only.';

comment on type public.payment_method is
  'Payment intent recorded with an order. The site takes no payment itself: `mobile_money_mtn`, `mobile_money_orange`, `bank_transfer` and `cash_on_confirmation` are all intent, confirmed by a staff member afterwards. `card` is legacy and never offered.';
