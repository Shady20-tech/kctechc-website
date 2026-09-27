-- =============================================================================
-- Phase 7 — Align the anonymous listing policy with the documented public set.
--
-- Phase 6 declared four public listing statuses:
--
--   PUBLIC_LISTING_STATUSES = published | under_offer | sold | rented
--
-- and the loaders query exactly those four for every public surface. The RLS
-- policy for `property_listings`, however, was written as `status = 'published'`
-- alone, and `listing_slugs` matched it. `public_listing_locations` used all four,
-- so the three tables disagreed with each other.
--
-- The disagreement was invisible while every reader went through the service-role
-- or the search RPC, both of which bypass RLS. It becomes a real defect now that
-- Phase 7 reads listings and localized slugs through the anonymous client: a sold
-- listing resolves through the query engine, then its slug fails to resolve
-- anonymously, and its coarsened map point resolves while its row does not. The
-- symptoms would be a listing that appears in the grid, 404s when clicked, and
-- still shows a marker on the map.
--
-- Why widening the policy is the right fix rather than narrowing the loader:
-- the four-status set is what the product intends to publish. A concluded listing
-- stays on the site deliberately — it is how a visitor sees that the company sells
-- property, and its page carries the reference and history. The status filter in
-- the browser is what lets a visitor ask for available property only, and that is
-- a *filter*, not a visibility rule.
--
-- The control this policy protects is unchanged: drafts, pending submissions,
-- rejected listings and archived listings remain unreachable to `anon`. Widening
-- from one public status to the four documented public statuses does not expose
-- anything that was meant to be private.
-- =============================================================================

drop policy if exists "property_listings_select_public" on public.property_listings;

create policy "property_listings_select_public"
  on public.property_listings for select
  to anon, authenticated
  using (
    status in ('published', 'under_offer', 'sold', 'rented')
  );

comment on policy "property_listings_select_public" on public.property_listings is
  'Anonymous read of the four public listing statuses. Drafts, pending, rejected and archived listings remain unreachable.';

drop policy if exists "listing_slugs_select_public" on public.listing_slugs;

create policy "listing_slugs_select_public"
  on public.listing_slugs for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id
        and p.status in ('published', 'under_offer', 'sold', 'rented')
    )
  );

comment on policy "listing_slugs_select_public" on public.listing_slugs is
  'A localized slug is publicly readable exactly when its listing is. Without this a concluded listing would render and then 404 on click.';
