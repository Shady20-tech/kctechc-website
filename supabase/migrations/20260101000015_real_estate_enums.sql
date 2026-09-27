-- =============================================================================
-- Phase 6 — Real estate enums and the role the approval queue needs.
--
-- Enums live in their own migration because PostgreSQL will not let a new enum
-- value be *used* in the same transaction that adds it, and Supabase runs each
-- migration file in one transaction. The tables that reference these values are
-- in the following migrations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- `real_estate_admin`.
--
-- The role model is symmetric per department: digital marketing and electrical
-- services each have a staff and an admin role, but real estate had only
-- `real_estate_agent`. That left the approval queue with no owner: without a
-- real-estate admin, only `super_admin` or `department_staff` could approve a
-- listing, and the one role that actually runs the property business could not.
--
-- Adding it here rather than reusing `real_estate_agent` is the point of the
-- phase's requirement that an agent's access is limited "unless their role
-- explicitly allows broader access". An agent works their own listings; an admin
-- works the queue and everyone's listings. Making that a distinct role means the
-- distinction is enforced by the database rather than by convention.
-- -----------------------------------------------------------------------------
alter type public.user_role add value if not exists 'real_estate_admin';

-- -----------------------------------------------------------------------------
-- What the listing offers. `short_term` is separate from `rent` because a
-- nightly rate, a minimum stay and an availability calendar are a different
-- product from a monthly tenancy, and collapsing them would force one model to
-- misrepresent the other.
-- -----------------------------------------------------------------------------
create type public.listing_type as enum (
  'sale',
  'rent',
  'lease',
  'short_term'
);

-- -----------------------------------------------------------------------------
-- Listing lifecycle.
--
-- The full set the phase requires, with `published` as the single state that is
-- publicly visible. `rejected` and `archived` are distinct: a rejected listing
-- failed review and may be corrected and resubmitted, whereas an archived one
-- was once valid and has been withdrawn. Collapsing them would lose which of the
-- two happened.
-- -----------------------------------------------------------------------------
create type public.listing_status as enum (
  'draft',
  'pending_review',
  'published',
  'under_offer',
  'sold',
  'rented',
  'archived',
  'rejected'
);

-- -----------------------------------------------------------------------------
-- Granular property kind.
--
-- Deliberately separate from the existing `property_type`
-- (residential / commercial / industrial), which stays as the broad class used
-- for filtering and for the electrical quote form. A buyer filters on "apartment",
-- while reporting groups by "residential"; one enum cannot serve both without
-- either losing the granularity or forcing a broad class onto every row.
-- -----------------------------------------------------------------------------
create type public.listing_property_kind as enum (
  'house',
  'apartment',
  'villa',
  'duplex',
  'studio',
  'bungalow',
  'land',
  'farm',
  'office',
  'shop',
  'warehouse',
  'hotel',
  'guesthouse',
  'restaurant',
  'mixed_use',
  'other'
);

-- -----------------------------------------------------------------------------
-- Price period.
--
-- A price is meaningless without it: 500,000 is an annual rent or a nightly rate
-- depending on this value. `total` is the default because it is the honest
-- reading of an unqualified price on a sale.
-- -----------------------------------------------------------------------------
create type public.price_period as enum (
  'total',
  'monthly',
  'quarterly',
  'yearly',
  'weekly',
  'nightly'
);

-- -----------------------------------------------------------------------------
-- Where a listing came from.
--
-- `owner_submission` is load-bearing rather than descriptive: the publish
-- readiness trigger refuses to publish a listing with this source unless an
-- administrator has approved it, which is how the phase's requirement that owner
-- submissions stay private until approved is enforced in the database instead of
-- in whichever code path happens to do the publishing.
-- -----------------------------------------------------------------------------
create type public.listing_source as enum (
  'admin',
  'agent',
  'owner_submission',
  'import'
);

-- -----------------------------------------------------------------------------
-- Review outcome for an owner submission.
-- -----------------------------------------------------------------------------
create type public.submission_status as enum (
  'pending_review',
  'approved',
  'rejected',
  'changes_requested'
);

-- -----------------------------------------------------------------------------
-- What a visitor did to a listing.
--
-- Kept as an enum so the analytics counter cannot fragment on spelling, and so
-- an event that is not in this set cannot be recorded and silently inflate a
-- metric that reports to the business.
-- -----------------------------------------------------------------------------
create type public.listing_event_type as enum (
  'view',
  'inquiry',
  'share',
  'save',
  'contact_reveal'
);

-- -----------------------------------------------------------------------------
-- Listing media alt text is translatable.
--
-- `content_translations` is keyed by (entity_type, entity_id, field_name), so
-- localizing an image's alt text needs its own entity type rather than a new
-- table. Added in this migration and first used in the translation migration.
-- -----------------------------------------------------------------------------
alter type public.translatable_entity_type add value if not exists 'property_media';
