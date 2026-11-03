-- =============================================================================
-- Purpose of acquisition on a property enquiry.
--
-- A property enquiry told the agent *which* listing and *what* the visitor
-- wanted, but not *why* they wanted it. That is the one fact that changes how an
-- enquiry is handled: a home to live in is a different conversation from an
-- investment or a business premises, and the team was reading the free-text
-- message to work it out.
--
-- It is modelled as an enum rather than free text so the answer is reportable
-- and cannot drift into a hundred spellings, and it is nullable because an
-- enquiry must never be blocked on it — a visitor who does not answer still gets
-- their message through.
--
-- This is a property-enquiry field, not a general one. A corporate contact or a
-- quote request has no acquisition to speak of, so the column stays null for
-- every other source rather than being forced into a shape that does not fit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The purpose a visitor is acquiring a property for.
--
-- Deliberately short. Each value is a distinct handling path, not a taxonomy:
-- `residence` is a family moving, `investment` is capital, `business` is
-- commercial premises, and `other` is the honest catch-all so nobody is forced
-- into a wrong box.
-- -----------------------------------------------------------------------------
create type public.acquisition_purpose as enum (
  'residence',
  'investment',
  'business',
  'other'
);

comment on type public.acquisition_purpose is
  'Why a visitor wants a property, as stated on a property enquiry. Nullable: an enquiry is never blocked on it.';

-- -----------------------------------------------------------------------------
-- The column.
--
-- Nullable with no default, so a row written before this migration (and every
-- non-property enquiry after it) reads as "not stated" rather than as a guess.
-- -----------------------------------------------------------------------------
alter table public.inquiries
  add column acquisition_purpose public.acquisition_purpose;

comment on column public.inquiries.acquisition_purpose is
  'The purpose the visitor stated for acquiring a property. Set from the property enquiry form; null for every other source and for a visitor who did not answer.';

-- -----------------------------------------------------------------------------
-- Index for reporting.
--
-- Partial, because only property enquiries ever carry a value. A full index
-- would be mostly nulls for a column that is only ever filtered within the
-- real-estate pipeline.
-- -----------------------------------------------------------------------------
create index inquiries_acquisition_purpose_idx
  on public.inquiries (acquisition_purpose, created_at desc)
  where acquisition_purpose is not null;
