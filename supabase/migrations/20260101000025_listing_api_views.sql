-- =============================================================================
-- Phase 6 — API read surface for the public map.
--
-- `public_listing_locations.approximate_location` is `geometry(Point,4326)`.
-- PostgREST returns a geometry column as an opaque value — it is not JSON, and
-- the client cannot turn it into a longitude and latitude without a PostGIS
-- dependency in the browser. So the API needs a read surface that exposes the
-- coordinates as plain numbers.
--
-- Why a view and not the function that reads the table directly: this is
-- `security_invoker`, so the view runs with the caller's rights and the RLS
-- policies on `public_listing_locations` still apply. The alternative — a
-- `security definer` function — would bypass RLS, and then the rule "the public
-- sees only published listings" would move from the database into whatever
-- filter a caller remembered to write. The view keeps the boundary where it
-- belongs.
--
-- The points are already snapped to a ~1km grid on write, so publishing them
-- discloses a neighbourhood, not an address.
-- =============================================================================

create or replace view public.listing_locations_api
with (security_invoker = true)
as
select
  l.listing_id,
  extensions.ST_X(l.approximate_location)::double precision as longitude,
  extensions.ST_Y(l.approximate_location)::double precision as latitude,
  l.precision_metres,
  l.updated_at
from public.public_listing_locations l
where l.approximate_location is not null;

comment on view public.listing_locations_api is
  'Coarsened listing positions as plain longitude/latitude numbers, for the public map. security_invoker, so the RLS policy on public_listing_locations still governs which rows a caller sees.';

-- -----------------------------------------------------------------------------
-- The same problem for the admin surface, in the other direction.
--
-- An administrator or the owning agent editing a listing needs the EXACT
-- coordinate, which lives on `listing_private_details`. That table is protected
-- by RLS with no anonymous policy, so a `security_invoker` view is again the
-- right shape: the admin sees the row, the public sees nothing, and the rule
-- stays in the policies.
-- -----------------------------------------------------------------------------
create or replace view public.listing_private_details_api
with (security_invoker = true)
as
select
  d.listing_id,
  d.exact_address,
  extensions.ST_X(d.exact_location)::double precision as exact_longitude,
  extensions.ST_Y(d.exact_location)::double precision as exact_latitude,
  d.owner_name,
  d.owner_phone,
  d.owner_email::text as owner_email,
  d.owner_notes,
  d.internal_notes,
  d.updated_at
from public.listing_private_details d;

comment on view public.listing_private_details_api is
  'Exact coordinates and owner contact as plain numbers, for the admin and owning-agent surface. security_invoker, so listing_private_details RLS applies and the anonymous role sees no rows.';

-- -----------------------------------------------------------------------------
-- Grants.
--
-- `anon` and `authenticated` need SELECT on the public view. The private view is
-- granted to `authenticated` only: the RLS policies on the underlying table are
-- what decide which authenticated caller sees which row, and granting it to
-- `anon` would be pointless since the policies there return nothing for anon —
-- but withholding the grant makes the intent legible.
-- -----------------------------------------------------------------------------
grant select on public.listing_locations_api to anon, authenticated;
grant select on public.listing_private_details_api to authenticated;

-- The service role, used by the admin client for server-side reads, is not
-- `anon`/`authenticated`; it bypasses RLS and reads the tables directly. No
-- grant needed there, and adding one would only widen the surface.
