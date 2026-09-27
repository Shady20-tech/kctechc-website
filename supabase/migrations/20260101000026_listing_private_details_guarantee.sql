-- =============================================================================
-- Phase 6 — Guarantee a listing always has its private-details row.
--
-- Migration 18 documents `listing_private_details` as "One row per listing,
-- created with the listing", and it is right that it must not be optional: the
-- per-listing row is where the exact coordinate and the owner contact live, and a
-- listing without one silently has neither. The absence would read as "not
-- recorded" rather than "the row was never created", which is exactly the kind of
-- quiet breakage the phase's checks are meant to catch.
--
-- The comment, however, described an intent no trigger implemented, and no
-- DEFAULT can create a row in another table. So the guarantee is added here.
--
-- A trigger rather than application code, for the reason the rest of the phase
-- uses triggers: an application insert can be forgotten by the next writer — a
-- migration, an import, a psql session — whereas a trigger fires for all of them.
-- The CSV importer inserts listings in bulk and does not know about this table;
-- this is what makes that safe.
-- =============================================================================

create or replace function public.create_listing_private_details()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.listing_private_details (listing_id)
  values (new.id)
  on conflict (listing_id) do nothing;

  return new;
end;
$$;

comment on function public.create_listing_private_details is
  'Creates the listing''s private-details row on insert, so a listing can never exist without the row that holds its exact location and owner contact.';

drop trigger if exists property_listings_create_private_details on public.property_listings;
create trigger property_listings_create_private_details
  after insert on public.property_listings
  for each row execute function public.create_listing_private_details();

-- -----------------------------------------------------------------------------
-- And the row must not be removable while its listing exists.
--
-- The insert trigger gives every listing a private row; without this, nothing
-- stops the next statement from deleting it, and the guarantee is only as strong
-- as the least careful writer. So a direct delete is refused.
--
-- Deletion by CASCADE must still work, or a listing could never be removed. The
-- two cases are told apart by whether the parent still exists: when a listing is
-- deleted, its cascade runs after the parent row is gone, so the check finds
-- nothing and permits the delete. This is verified in the migration's tests
-- rather than assumed, because it depends on when the RI trigger fires.
-- -----------------------------------------------------------------------------
create or replace function public.prevent_listing_private_details_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.property_listings where id = old.listing_id
  ) then
    raise exception
      'The private details of listing % cannot be deleted while the listing exists',
      old.listing_id
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

comment on function public.prevent_listing_private_details_delete is
  'Refuses to delete a listing''s private-details row while the listing exists. Cascade deletes still pass, because the parent row is already gone when the cascade fires.';

drop trigger if exists listing_private_details_prevent_delete on public.listing_private_details;
create trigger listing_private_details_prevent_delete
  before delete on public.listing_private_details
  for each row execute function public.prevent_listing_private_details_delete();

-- -----------------------------------------------------------------------------
-- Backfill. A listing created between migration 18 and now would have no private
-- row; inserting one is idempotent and gives every existing listing the same
-- shape a new one has.
-- -----------------------------------------------------------------------------
insert into public.listing_private_details (listing_id)
select p.id
from public.property_listings p
left join public.listing_private_details d on d.listing_id = p.id
where d.listing_id is null
on conflict (listing_id) do nothing;
