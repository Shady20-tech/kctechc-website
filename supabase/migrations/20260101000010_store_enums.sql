-- =============================================================================
-- Phase 4 — Store enums
--
-- Enums are added in their own migration because PostgreSQL will not let a new
-- enum value be *used* in the same transaction that adds it. Supabase runs each
-- migration file in one transaction, so the store tables that reference these
-- values live in the following migration.
-- =============================================================================

-- Google Merchant Center's `availability` vocabulary, narrowed to the states
-- this catalogue can truthfully represent. `discontinued` is included so a
-- withdrawn product can be marked rather than silently deleted, which is what
-- Merchant Center expects.
create type public.product_availability as enum (
  'in_stock',
  'out_of_stock',
  'preorder',
  'backorder',
  'discontinued'
);

-- Merchant Center's `condition` vocabulary. `new` is the default because a
-- catalogue must not imply refurbished or used stock unless it says so.
create type public.product_condition as enum (
  'new',
  'refurbished',
  'used'
);

-- Why a stock level changed. Kept as an enum so an inventory report cannot
-- fragment on spelling, and so an unexplained adjustment cannot be recorded
-- without choosing a reason.
create type public.inventory_reason as enum (
  'initial',
  'restock',
  'sale',
  'return',
  'correction',
  'damage'
);

-- Cart lifecycle. `converted` and `abandoned` are terminal, which is what lets
-- an active cart be looked up without scanning finished ones.
create type public.cart_status as enum (
  'active',
  'converted',
  'abandoned',
  'expired'
);

-- -----------------------------------------------------------------------------
-- Media alt text is translatable.
--
-- `content_translations` is keyed by (entity_type, entity_id, field_name), so
-- localizing an image's alt text needs a `product_media` entity type rather than
-- a new table. Adding the member here lets the existing translation machinery
-- carry alt text with no new schema.
-- -----------------------------------------------------------------------------
alter type public.translatable_entity_type add value if not exists 'product_media';
