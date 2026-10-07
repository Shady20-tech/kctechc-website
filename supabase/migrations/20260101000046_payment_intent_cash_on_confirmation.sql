-- =============================================================================
-- Payment methods: offer an explicit "pay on confirmation" choice.
--
-- The site no longer takes payment itself. A customer sends an order, chooses how
-- they intend to pay, and the business contacts them to finalise it. That intent
-- is recorded (not an attempt to charge), so it needs a method that says exactly
-- what it is rather than being forced into `bank_transfer`.
--
-- `cash_on_confirmation` is the "arrange payment with our team" choice. The three
-- existing methods remain valid because a customer may still say, up front, that
-- they intend to use mobile money or a transfer — the choice is intent, and the
-- finalisation is a human step either way.
--
-- `card` stays in the enum: it is a legacy value on stored rows, and removing a
-- value from a live enum is a destructive migration for no gain. It is still not
-- offered by the checkout schema.
--
-- PostgreSQL cannot drop an enum value, so `add value if not exists` is the
-- idempotent, non-destructive form. Note the value is added to the END of the
-- enum's ordering, which is irrelevant here because nothing sorts by it.
-- =============================================================================

alter type public.payment_method add value if not exists 'cash_on_confirmation';

comment on type public.payment_method is
  'Payment intent recorded with an order. `cash_on_confirmation` means the customer will agree the method with our team; no payment is taken on this site. `card` is legacy and never offered.';
