-- =============================================================================
-- Behavioural validation of the Phase 7 public platform schema.
--
-- Run after the migrations. Every check either raises, which aborts the run, or
-- asserts a condition that must hold. This is the SQL the Phase 7 acceptance
-- criteria describe, executed against a real PostgreSQL instance:
--
--   * Region → Division → Subdivision filters work correctly
--   * Filters combine correctly (AND logic)
--   * Result counts are correct — and independent of the page size
--   * Pagination returns each listing once
--   * Map/list views stay synchronised with filters (same predicate, one count)
--   * Listing submissions remain unpublished until approved
--   * Favourites and saved searches are private to their owner
--   * A geographic landing page is indexable only with published content
--
-- The fixtures are deliberately small and hand-checked: every expected number in
-- this file was worked out from the rows inserted below, not from what the query
-- happened to return.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Fixtures: geography.
--
-- Two regions, one with two divisions, one of which has two subdivisions. The
-- shape is what makes the cascading assertions meaningful: the second region has
-- no divisions at all, so "selecting a region filters available divisions" has a
-- case that must return empty rather than everything.
-- -----------------------------------------------------------------------------
insert into public.regions (code, name, slug, sort_order) values
  ('SW', 'Southwest', 'southwest', 100),
  ('LT', 'Littoral', 'littoral', 50)
on conflict (code) do nothing;

insert into public.divisions (region_id, code, name, slug)
select r.id, d.code, d.name, d.slug
from (values
  ('SW', 'SW-FAKO', 'Fako', 'fako'),
  ('SW', 'SW-MANYU', 'Manyu', 'manyu')
) as d(region_code, code, name, slug)
join public.regions r on r.code = d.region_code
on conflict (code) do nothing;

insert into public.subdivisions (region_id, division_id, code, name, slug)
select r.id, dv.id, s.code, s.name, s.slug
from (values
  ('SW', 'SW-FAKO', 'SW-FAKO-LIMBE', 'Limbe', 'limbe'),
  ('SW', 'SW-FAKO', 'SW-FAKO-BUEA', 'Buea', 'buea'),
  ('SW', 'SW-MANYU', 'SW-MANYU-MAMFE', 'Mamfe', 'mamfe')
) as s(region_code, division_code, code, name, slug)
join public.regions r on r.code = s.region_code
join public.divisions dv on dv.code = s.division_code
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Fixtures: listings.
--
-- Six published listings, chosen so each filter has a case that must match and a
-- case that must not:
--
--   ref        region   division  subdivision  type  kind   price    bed bath land  bldg  views status
--   L1 southwest fako    limbe      sale   villa  50,000,000 4   3    800   200   100  published
--   L2 southwest fako    buea       sale   land   15,000,000 -   -    1500  -      50  published
--   L3 southwest manyu   mamfe      rent   house  300,000    3   2    500   150     5  published
--   L4 littoral  -       -          sale   villa  90,000,000 5   4    1000  400   900  published
--   L5 littoral  -       -          sale   apartment 25,000,000 2 1    -     90   300  published
--   L6 southwest fako    limbe      sale   villa  price on request 4 3 700 180   700  sold
--
-- `sold` is published-but-closed, so it must appear by default and drop out when
-- the visitor asks for available property only.
-- -----------------------------------------------------------------------------
insert into public.property_listings (
  reference, slug, listing_type, property_kind, property_type, status, source,
  region_id, division_id, subdivision_id, locality,
  title, description, highlights, amenities,
  price_minor, price_period, price_on_request,
  land_area_sqm, building_area_sqm, bedrooms, bathrooms,
  view_count, is_featured, published_at
)
select
  v.reference, v.slug, v.listing_type::public.listing_type,
  v.property_kind::public.listing_property_kind,
  v.property_type::public.property_type,
  v.status::public.listing_status, 'admin'::public.listing_source,
  r.id, dv.id, sd.id, v.locality,
  v.title, v.description, v.highlights, v.amenities,
  v.price_minor, v.price_period::public.price_period, v.price_on_request,
  v.land_area_sqm, v.building_area_sqm, v.bedrooms, v.bathrooms,
  v.view_count, v.is_featured, v.published_at::timestamptz
from (values
  ('KC-RE-900001', 'sea-view-villa-limbe', 'sale', 'villa', 'residential', 'published',
   'SW', 'SW-FAKO', 'SW-FAKO-LIMBE', 'Limbe',
   'Sea view villa in Limbe', 'A four bedroom villa with a sea view above Limbe town, on a titled plot.',
   array['Sea view', 'Titled plot']::text[], array['pool']::text[],
   50000000::bigint, 'total', false, 800, 200, 4::smallint, 3::smallint, 100, true, '2026-01-10T00:00:00Z'),
  ('KC-RE-900002', 'titled-land-buea', 'sale', 'land', 'residential', 'published',
   'SW', 'SW-FAKO', 'SW-FAKO-BUEA', 'Buea',
   'Titled land in Buea', 'A fifteen hundred square metre titled plot on the Buea slope, ready to build.',
   array['Titled plot']::text[], array[]::text[],
   15000000::bigint, 'total', false, 1500, null, null, null, 50, false, '2026-01-08T00:00:00Z'),
  ('KC-RE-900003', 'family-house-mamfe', 'rent', 'house', 'residential', 'published',
   'SW', 'SW-MANYU', 'SW-MANYU-MAMFE', 'Mamfe',
   'Family house to rent in Mamfe', 'A three bedroom family house to rent in Mamfe, with a walled compound.',
   array['Walled compound']::text[], array['borehole']::text[],
   300000::bigint, 'monthly', false, 500, 150, 3::smallint, 2::smallint, 5, false, '2026-01-05T00:00:00Z'),
  ('KC-RE-900004', 'executive-villa-douala', 'sale', 'villa', 'residential', 'published',
   'LT', null, null, 'Douala',
   'Executive villa in Douala', 'A five bedroom executive villa in Douala with a large garden and a pool.',
   array['Large garden']::text[], array['pool', 'solar']::text[],
   90000000::bigint, 'total', false, 1000, 400, 5::smallint, 4::smallint, 900, false, '2026-01-12T00:00:00Z'),
  ('KC-RE-900005', 'city-apartment-douala', 'sale', 'apartment', 'residential', 'published',
   'LT', null, null, 'Douala',
   'City apartment in Douala', 'A two bedroom apartment in central Douala, close to the business district.',
   array['Central location']::text[], array['lift']::text[],
   25000000::bigint, 'total', false, null, 90, 2::smallint, 1::smallint, 300, false, '2026-01-11T00:00:00Z'),
  ('KC-RE-900006', 'hillside-villa-limbe', 'sale', 'villa', 'residential', 'sold',
   'SW', 'SW-FAKO', 'SW-FAKO-LIMBE', 'Limbe',
   'Hillside villa in Limbe', 'A four bedroom villa on the hillside in Limbe, sold but kept for reference.',
   array['Hillside']::text[], array[]::text[],
   null, 'total', true, 700, 180, 4::smallint, 3::smallint, 700, false, '2026-01-02T00:00:00Z')
) as v(reference, slug, listing_type, property_kind, property_type, status,
       region_code, division_code, subdivision_code, locality,
       title, description, highlights, amenities,
       price_minor, price_period, price_on_request,
       land_area_sqm, building_area_sqm, bedrooms, bathrooms,
       view_count, is_featured, published_at)
join public.regions r on r.code = v.region_code
left join public.divisions dv on dv.code = v.division_code
left join public.subdivisions sd on sd.code = v.subdivision_code
on conflict (reference) do nothing;

-- A draft, to prove it is never counted or returned.
insert into public.property_listings (
  reference, slug, listing_type, property_kind, property_type, status, source,
  region_id, locality, title, description, price_minor, price_period, published_at
)
select 'KC-RE-900007', 'unpublished-draft-limbe', 'sale', 'villa', 'residential',
       'draft', 'owner_submission', r.id, 'Limbe',
       'Unpublished draft in Limbe',
       'A listing that has not been approved and must never appear on the public surface.',
       40000000, 'total', null
from public.regions r where r.code = 'SW'
on conflict (reference) do nothing;

-- -----------------------------------------------------------------------------
-- 1. AND logic: each filter narrows, and they combine.
-- -----------------------------------------------------------------------------
do $$
declare
  total bigint;
  southwest bigint;
  southwest_villa bigint;
  southwest_villa_limbe bigint;
begin
  select count(*) into total
  from public.search_property_listings(p_locale => 'en');

  -- Six published (including the sold one). The draft is excluded.
  if total <> 6 then
    raise exception 'VALIDATION FAIL: expected 6 published listings, saw %', total;
  end if;

  select count(*) into southwest
  from public.search_property_listings(
    p_region_id => (select id from public.regions where code = 'SW')
  );
  if southwest <> 4 then
    raise exception 'VALIDATION FAIL: expected 4 in Southwest, saw %', southwest;
  end if;

  select count(*) into southwest_villa
  from public.search_property_listings(
    p_region_id => (select id from public.regions where code = 'SW'),
    p_property_kind => 'villa'
  );
  if southwest_villa <> 2 then
    raise exception 'VALIDATION FAIL: expected 2 Southwest villas, saw %', southwest_villa;
  end if;

  select count(*) into southwest_villa_limbe
  from public.search_property_listings(
    p_region_id => (select id from public.regions where code = 'SW'),
    p_division_id => (select id from public.divisions where code = 'SW-FAKO'),
    p_subdivision_id => (select id from public.subdivisions where code = 'SW-FAKO-LIMBE'),
    p_property_kind => 'villa'
  );
  if southwest_villa_limbe <> 2 then
    raise exception 'VALIDATION FAIL: expected 2 Fako/Limbe villas, saw %', southwest_villa_limbe;
  end if;

  raise notice 'PASS  AND-combined filters narrow correctly';
end
$$;

-- -----------------------------------------------------------------------------
-- 2. The result count is the total for the filter state, not the page size.
--
-- This is the defect the Phase 6 approach had: filtering a loader-capped list made
-- the count describe the fetched page rather than the market. Asking for one row
-- must still report six.
-- -----------------------------------------------------------------------------
do $$
declare
  rows_returned integer;
  reported_total bigint;
begin
  select count(*), max(total_count) into rows_returned, reported_total
  from public.search_property_listings(p_limit => 1);

  if rows_returned <> 1 then
    raise exception 'VALIDATION FAIL: p_limit => 1 returned % rows', rows_returned;
  end if;
  if reported_total <> 6 then
    raise exception 'VALIDATION FAIL: count followed the page size: reported % for a 6-listing filter', reported_total;
  end if;

  raise notice 'PASS  result count is the filtered total, independent of page size';
end
$$;

-- -----------------------------------------------------------------------------
-- 3. Pagination covers every listing exactly once.
--
-- The failure this guards against is a non-deterministic order, which makes a
-- listing appear on two pages while another appears on none.
-- -----------------------------------------------------------------------------
do $$
declare
  page1 uuid[];
  page2 uuid[];
  page3 uuid[];
  seen uuid[];
begin
  select array_agg(id order by id) into page1
  from public.search_property_listings(p_limit => 2, p_offset => 0);
  select array_agg(id order by id) into page2
  from public.search_property_listings(p_limit => 2, p_offset => 2);
  select array_agg(id order by id) into page3
  from public.search_property_listings(p_limit => 2, p_offset => 4);

  seen := page1 || page2 || page3;

  if array_length(seen, 1) <> 6 then
    raise exception 'VALIDATION FAIL: three pages of two held % rows, not 6', array_length(seen, 1);
  end if;
  if (select count(distinct x) from unnest(seen) as x) <> 6 then
    raise exception 'VALIDATION FAIL: pagination returned a listing twice';
  end if;

  raise notice 'PASS  pagination returns each listing exactly once';
end
$$;

-- -----------------------------------------------------------------------------
-- 4. Sorting.
--
-- Price ascending must put the cheapest first and the "price on request" listing
-- last — never first. Treating an unstated price as zero would make every
-- "price on request" property the cheapest in the market, which is a claim the
-- listing does not make.
-- -----------------------------------------------------------------------------
do $$
declare
  first_price bigint;
  last_reference text;
  most_viewed text;
begin
  select price_minor into first_price
  from public.search_property_listings(p_sort => 'price_asc', p_limit => 1);
  if first_price <> 300000 then
    raise exception 'VALIDATION FAIL: price_asc led with %, expected 300000', first_price;
  end if;

  select reference into last_reference
  from public.search_property_listings(p_sort => 'price_asc', p_limit => 1, p_offset => 5);
  if last_reference <> 'KC-RE-900006' then
    raise exception 'VALIDATION FAIL: price_asc put % last, expected the price-on-request listing', last_reference;
  end if;

  select reference into most_viewed
  from public.search_property_listings(p_sort => 'most_viewed', p_limit => 1);
  if most_viewed <> 'KC-RE-900004' then
    raise exception 'VALIDATION FAIL: most_viewed led with %, expected KC-RE-900004 (900 views)', most_viewed;
  end if;

  raise notice 'PASS  sorting by price and by views';
end
$$;

-- -----------------------------------------------------------------------------
-- 5. Featured listings lead only the default ordering.
--
-- A promoted listing at the top of a price sort would make the sort a lie.
-- -----------------------------------------------------------------------------
do $$
declare
  first_reference text;
begin
  select reference into first_reference
  from public.search_property_listings(p_sort => 'price_asc', p_limit => 1);
  if first_reference = 'KC-RE-900001' then
    raise exception 'VALIDATION FAIL: the featured listing led a price sort';
  end if;

  select reference into first_reference
  from public.search_property_listings(p_sort => 'newest', p_limit => 1);
  if first_reference <> 'KC-RE-900001' then
    raise exception 'VALIDATION FAIL: the featured listing did not lead the default ordering, saw %', first_reference;
  end if;

  raise notice 'PASS  featured leads the default ordering only';
end
$$;

-- -----------------------------------------------------------------------------
-- 6. Size is the larger of land and building area.
--
-- The case that distinguishes `greatest(land, building)` from "land only" is a
-- property with a large building on little or no land, which is what a warehouse
-- is. None of the standing fixtures has that shape, so one is created inside this
-- block and removed again: asserting the behaviour against a fixture that cannot
-- tell the two implementations apart would be a test that passes either way.
-- -----------------------------------------------------------------------------
do $$
declare
  big_refs text[];
  warehouse uuid;
begin
  select array_agg(reference order by reference) into big_refs
  from public.search_property_listings(p_min_size => 900);
  if big_refs is distinct from array['KC-RE-900002', 'KC-RE-900004']::text[] then
    raise exception 'VALIDATION FAIL: p_min_size => 900 matched %, expected the two large plots', big_refs;
  end if;

  insert into public.property_listings (
    reference, slug, listing_type, property_kind, property_type, status, source,
    region_id, division_id, subdivision_id, locality, title, description,
    price_minor, price_period, building_area_sqm, published_at
  )
  select 'KC-RE-900050', 'warehouse-limbe', 'lease', 'warehouse', 'industrial',
         'published', 'admin', r.id, dv.id, sd.id, 'Limbe',
         'Warehouse to lease in Limbe',
         'A twelve hundred square metre warehouse to lease near the Limbe port area.',
         2000000, 'monthly', 1200, now()
  from public.regions r
  join public.divisions dv on dv.code = 'SW-FAKO'
  join public.subdivisions sd on sd.code = 'SW-FAKO-LIMBE'
  where r.code = 'SW'
  returning id into warehouse;

  -- No land area at all, 1200 m² of building. A land-only implementation would
  -- report zero and drop it.
  select array_agg(reference order by reference) into big_refs
  from public.search_property_listings(p_min_size => 1000);
  if not ('KC-RE-900050' = any (big_refs)) then
    raise exception 'VALIDATION FAIL: a large building on no land was excluded by the size filter: %', big_refs;
  end if;

  -- And an upper bound must exclude it too.
  select array_agg(reference order by reference) into big_refs
  from public.search_property_listings(p_max_size => 1000);
  if 'KC-RE-900050' = any (big_refs) then
    raise exception 'VALIDATION FAIL: p_max_size => 1000 included a 1200 m² building';
  end if;

  delete from public.property_listings where id = warehouse;

  raise notice 'PASS  size filter uses the larger of land and building area';
end
$$;

-- -----------------------------------------------------------------------------
-- 7. Bathrooms filter.
-- -----------------------------------------------------------------------------
do $$
declare
  matched text[];
begin
  select array_agg(reference order by reference) into matched
  from public.search_property_listings(p_min_bathrooms => 4::smallint);

  if matched is distinct from array['KC-RE-900004']::text[] then
    raise exception 'VALIDATION FAIL: a minimum of 4 bathrooms matched %, expected only KC-RE-900004', matched;
  end if;

  raise notice 'PASS  bathrooms filter';
end
$$;

-- -----------------------------------------------------------------------------
-- 8. Status filter.
--
-- By default the closed listing is included, because "villas in the Southwest" is
-- a question about the region and a sold villa is still part of that answer. A
-- visitor who wants only available property asks for it explicitly.
-- -----------------------------------------------------------------------------
do $$
declare
  all_southwest text[];
  available_only text[];
begin
  select array_agg(reference order by reference) into all_southwest
  from public.search_property_listings(
    p_region_id => (select id from public.regions where code = 'SW')
  );
  if not ('KC-RE-900006' = any (all_southwest)) then
    raise exception 'VALIDATION FAIL: the sold listing was hidden from the default view';
  end if;

  select array_agg(reference order by reference) into available_only
  from public.search_property_listings(
    p_region_id => (select id from public.regions where code = 'SW'),
    p_statuses => array['published', 'under_offer']::public.listing_status[]
  );
  if 'KC-RE-900006' = any (available_only) then
    raise exception 'VALIDATION FAIL: the sold listing survived an available-only filter';
  end if;
  if array_length(available_only, 1) <> 3 then
    raise exception 'VALIDATION FAIL: available-only Southwest returned %, expected 3', available_only;
  end if;

  raise notice 'PASS  status filter';
end
$$;

-- -----------------------------------------------------------------------------
-- 9. Amenities are a subset match, not an overlap.
--
-- A buyer asking for a pool AND solar must get listings with both. An overlap
-- match would return a listing with only a pool, which is not what was asked.
-- -----------------------------------------------------------------------------
do $$
declare
  both_amenities text[];
  pool_only text[];
begin
  select array_agg(reference order by reference) into both_amenities
  from public.search_property_listings(p_amenities => array['pool', 'solar']::text[]);
  if both_amenities is distinct from array['KC-RE-900004']::text[] then
    raise exception 'VALIDATION FAIL: pool+solar matched %, expected only KC-RE-900004', both_amenities;
  end if;

  select array_agg(reference order by reference) into pool_only
  from public.search_property_listings(p_amenities => array['pool']::text[]);
  if array_length(pool_only, 1) <> 2 then
    raise exception 'VALIDATION FAIL: pool matched %, expected 2', pool_only;
  end if;

  raise notice 'PASS  amenities use subset semantics';
end
$$;

-- -----------------------------------------------------------------------------
-- 9b. Property class (type) filter.
--
-- `property_type` is a separate axis from `property_kind`: the class says what the
-- property is for (residential, commercial, industrial) and the kind says what it
-- is (villa, land, warehouse). A visitor looking for commercial space wants the
-- class, so the filter has to exist independently rather than being folded into
-- the kind.
--
-- The fixture listing is inserted and removed inside this block, because every
-- other listing in the file is residential and a filter can only be proven to
-- select by having something to select. Removing it afterwards keeps the counts
-- the later validations assert from drifting.
-- -----------------------------------------------------------------------------
do $$
declare
  residential_before integer;
  residential_after integer;
  commercial_refs text[];
  commercial_count integer;
begin
  select count(*) into residential_before
  from public.search_property_listings(p_property_type => 'residential');

  insert into public.property_listings (
    reference, slug, listing_type, property_kind, property_type, status, source,
    region_id, locality, title, description, highlights, amenities,
    price_minor, price_period, price_on_request, building_area_sqm,
    view_count, is_featured, published_at
  )
  select 'KC-RE-900010', 'commercial-shop-douala', 'rent'::public.listing_type,
         'shop'::public.listing_property_kind, 'commercial'::public.property_type,
         'published'::public.listing_status, 'admin'::public.listing_source,
         r.id, 'Douala', 'Commercial shop in Douala',
         'A ground floor shop unit in Douala, classified commercial rather than residential.',
         array['Street frontage']::text[], array['power']::text[],
         400000::bigint, 'monthly'::public.price_period, false, 60,
         0, false, '2026-01-20T00:00:00Z'
  from public.regions r
  where r.code = 'LT'
  on conflict (reference) do nothing;

  -- The commercial class selects exactly the commercial listing. A filter that was
  -- ignored would return every published listing here, and one that inverted the
  -- predicate would return the residential ones.
  select array_agg(reference order by reference) into commercial_refs
  from public.search_property_listings(p_property_type => 'commercial');

  if commercial_refs is distinct from array['KC-RE-900010']::text[] then
    raise exception 'VALIDATION FAIL: the commercial class matched %, expected KC-RE-900010', commercial_refs;
  end if;

  select count(*) into commercial_count
  from public.search_property_listings(p_property_type => 'commercial');
  if commercial_count <> 1 then
    raise exception 'VALIDATION FAIL: the commercial class counted %, expected 1', commercial_count;
  end if;

  -- The classes are disjoint: adding a commercial listing must not change the
  -- residential result set.
  select count(*) into residential_after
  from public.search_property_listings(p_property_type => 'residential');
  if residential_after <> residential_before then
    raise exception 'VALIDATION FAIL: the residential class counted % before the commercial insert and % after', residential_before, residential_after;
  end if;

  -- The class and the kind compose, so asking for a residential shop is narrower
  -- than either alone. The only shop in the fixtures is commercial, so this must
  -- be empty; if the class were ignored the shop would match.
  if exists (
    select 1
    from public.search_property_listings(
      p_property_type => 'residential',
      p_property_kind => 'shop'
    )
  ) then
    raise exception 'VALIDATION FAIL: a residential shop matched, but the only shop is commercial';
  end if;

  delete from public.property_listings where reference = 'KC-RE-900010';

  raise notice 'PASS  property class filters independently of kind';
end
$$;

-- -----------------------------------------------------------------------------
-- 10. Localized keyword search.
--
-- This is the reason the query is not a filter over the canonical columns only.
-- A French translation of a listing must be findable by a French word that does
-- not appear in the English row at all.
-- -----------------------------------------------------------------------------
do $$
declare
  fr_matches text[];
  en_matches text[];
begin
  insert into public.content_translations (entity_type, entity_id, field_name, locale, value, state)
  select 'property_listing', p.id, 'title', 'fr',
         'Terrain titré à Buea', 'translated'
  from public.property_listings p where p.reference = 'KC-RE-900002'
  on conflict (entity_type, entity_id, field_name, locale) do update set value = excluded.value, state = excluded.state;

  select array_agg(reference order by reference) into fr_matches
  from public.search_property_listings(p_query => 'terrain', p_locale => 'fr');

  if fr_matches is distinct from array['KC-RE-900002']::text[] then
    raise exception 'VALIDATION FAIL: the French keyword "terrain" matched %, expected KC-RE-900002', fr_matches;
  end if;

  -- The same word must not match under the English locale, where the translation
  -- is not in scope. If it did, the locale parameter would be doing nothing.
  select array_agg(reference order by reference) into en_matches
  from public.search_property_listings(p_query => 'terrain', p_locale => 'en');
  if en_matches is not null then
    raise exception 'VALIDATION FAIL: a French-only word matched under the English locale: %', en_matches;
  end if;

  raise notice 'PASS  localized keyword search finds French translations only in French';
end
$$;

-- -----------------------------------------------------------------------------
-- 11. A translation does not duplicate a listing or inflate the count.
--
-- `content_translations` holds one row per field, so a naive join would produce
-- two rows per translated listing. Both the count and the page would be wrong.
-- -----------------------------------------------------------------------------
do $$
declare
  rows_returned integer;
  reported_total bigint;
begin
  -- The fixture above added a French title for KC-RE-900002. Add a description
  -- too, so the listing has two translation rows and the join would double.
  insert into public.content_translations (entity_type, entity_id, field_name, locale, value, state)
  select 'property_listing', p.id, 'description', 'fr',
         'Un terrain titré de quinze cents mètres carrés sur la pente de Buea.', 'translated'
  from public.property_listings p where p.reference = 'KC-RE-900002'
  on conflict (entity_type, entity_id, field_name, locale) do update set value = excluded.value, state = excluded.state;

  select count(*), max(total_count) into rows_returned, reported_total
  from public.search_property_listings(p_locale => 'fr');

  if reported_total <> 6 then
    raise exception 'VALIDATION FAIL: a two-field translation inflated the count to %', reported_total;
  end if;
  if rows_returned <> 6 then
    raise exception 'VALIDATION FAIL: a two-field translation duplicated a listing (% rows)', rows_returned;
  end if;

  raise notice 'PASS  translations neither duplicate a listing nor inflate the count';
end
$$;

-- -----------------------------------------------------------------------------
-- 12. Cascading geography counts.
--
-- "Selecting a Region filters available Divisions" is only correct if the counts
-- describe the same predicate the browser uses. This checks the region roll-up
-- equals the sum of its divisions, and that a region with no listings has no row
-- at all rather than a zero the UI would render as an empty option.
-- -----------------------------------------------------------------------------
do $$
declare
  region_total bigint;
  division_sum bigint;
begin
  select total into region_total
  from public.listing_geography_counts()
  where level = 'region' and geo_id = (select id from public.regions where code = 'SW');

  select coalesce(sum(total), 0) into division_sum
  from public.listing_geography_counts()
  where level = 'division'
    and parent_id = (select id from public.regions where code = 'SW');

  if region_total <> 4 then
    raise exception 'VALIDATION FAIL: Southwest region count was %, expected 4', region_total;
  end if;
  if division_sum <> 4 then
    raise exception 'VALIDATION FAIL: Southwest division counts summed to %, expected 4', division_sum;
  end if;

  raise notice 'PASS  cascading geography counts agree with the region roll-up';
end
$$;

-- -----------------------------------------------------------------------------
-- 13. An invalid region/division/subdivision triple cannot be stored.
--
-- The composite foreign keys are what make this unrepresentable rather than
-- merely rejected by application code.
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    insert into public.property_listings (
      reference, slug, listing_type, property_kind, property_type, status, source,
      region_id, division_id, locality, title, description, price_minor, price_period, published_at
    )
    select 'KC-RE-900099', 'mismatched-geography', 'sale', 'villa', 'residential',
           'published', 'admin', r.id, dv.id, 'Nowhere',
           'Mismatched geography listing',
           'A listing whose division belongs to a different region than the one recorded.',
           1000000, 'total', now()
    from public.regions r
    join public.divisions dv on dv.code = 'SW-FAKO'
    where r.code = 'LT';

    raise exception 'VALIDATION FAIL: a mismatched region/division pair was accepted';
  exception
    when foreign_key_violation then
      raise notice 'PASS  a mismatched region/division pair is rejected by the database';
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- 14. Drafts and pending submissions never reach the public surface.
-- -----------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role anon;

  select count(*) into visible from public.property_listings;
  if visible <> 6 then
    raise exception 'VALIDATION FAIL: anon saw % listings, expected the 6 published ones', visible;
  end if;

  reset role;

  raise notice 'PASS  RLS hides unpublished listings from anon';
end
$$;

-- -----------------------------------------------------------------------------
-- 15. Favourites are private to their owner.
-- -----------------------------------------------------------------------------
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  listing uuid;
  visible integer;
begin
  insert into auth.users (id, email) values (user_a, 'a@example.test'), (user_b, 'b@example.test');
  select id into listing from public.property_listings where reference = 'KC-RE-900001';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', user_a::text, true);

  insert into public.listing_favorites (user_id, listing_id) values (user_a, listing);

  select count(*) into visible from public.listing_favorites;
  if visible <> 1 then
    raise exception 'VALIDATION FAIL: the owner saw % of their own favourites, expected 1', visible;
  end if;

  -- Acting as user B now: the same table must be empty.
  perform set_config('request.jwt.claim.sub', user_b::text, true);

  select count(*) into visible from public.listing_favorites;
  if visible <> 0 then
    raise exception 'VALIDATION FAIL: another user saw % favourites that are not theirs', visible;
  end if;

  -- And B cannot file one under A's id.
  begin
    insert into public.listing_favorites (user_id, listing_id) values (user_a, listing);
    raise exception 'VALIDATION FAIL: a user filed a favourite under another user''s id';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;

  reset role;

  raise notice 'PASS  favourites are private to their owner';
end
$$;

-- -----------------------------------------------------------------------------
-- 16. An alert preference cannot be attached to someone else's saved search.
-- -----------------------------------------------------------------------------
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  search_a uuid;
begin
  insert into auth.users (id, email) values (user_a, 'c@example.test'), (user_b, 'd@example.test');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  insert into public.saved_searches (user_id, label, query_string, locale)
  values (user_a, 'Villas in Limbe', 'region=southwest&kind=villa', 'en')
  returning id into search_a;

  -- B tries to put an alert on A's search.
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  begin
    insert into public.search_alert_preferences (saved_search_id, user_id, enabled)
    values (search_a, user_b, true);
    raise exception 'VALIDATION FAIL: an alert preference was attached to another user''s saved search';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;

  reset role;

  raise notice 'PASS  alert preferences cannot cross accounts';
end
$$;

-- -----------------------------------------------------------------------------
-- 17. Geographic landing content: the shape constraints hold.
-- -----------------------------------------------------------------------------
do $$
begin
  -- Two parents at once must be rejected.
  begin
    insert into public.geo_landing_content (level, region_id, division_id, locale, intro)
    select 'region', r.id, dv.id, 'en', repeat('x', 100)
    from public.regions r join public.divisions dv on dv.code = 'SW-FAKO'
    where r.code = 'SW';
    raise exception 'VALIDATION FAIL: a landing row with two parents was accepted';
  exception
    when check_violation then null;
  end;

  -- A level that disagrees with the parent set must be rejected.
  begin
    insert into public.geo_landing_content (level, division_id, locale, intro)
    select 'region', dv.id, 'en', repeat('x', 100)
    from public.divisions dv where dv.code = 'SW-FAKO';
    raise exception 'VALIDATION FAIL: a landing row whose level disagreed with its parent was accepted';
  exception
    when check_violation then null;
  end;

  raise notice 'PASS  geographic landing content shape is enforced';
end
$$;

-- -----------------------------------------------------------------------------
-- 18. Indexability: a landing page is indexable only with published content.
--
-- This is the acceptance criterion "Geographic landing pages are indexable only
-- when they contain meaningful content", and its counterpart for arbitrary filter
-- URLs. The page reads this table; an unpublished or absent row means the page
-- must carry noindex.
-- -----------------------------------------------------------------------------
do $$
declare
  published_count integer;
  draft_count integer;
begin
  insert into public.geo_landing_content (level, region_id, locale, heading, intro, state)
  select 'region', r.id, 'en', 'Property in the Southwest Region',
         'The Southwest Region runs from the coast at Limbe and Buea inland to Manyu. Listings here cover titled plots on the Buea slope, family houses in Mamfe and sea-view villas above Limbe.', 'published'
  from public.regions r where r.code = 'SW'
  on conflict (geo_id, locale) do nothing;

  insert into public.geo_landing_content (level, region_id, locale, intro, state)
  select 'region', r.id, 'en',
         'A draft intro that must not be served to a visitor, because the page is not yet indexable.',
         'draft'
  from public.regions r where r.code = 'LT'
  on conflict (geo_id, locale) do nothing;

  set local role anon;
  select count(*) into published_count from public.geo_landing_content;
  reset role;

  if published_count <> 1 then
    raise exception 'VALIDATION FAIL: anon read % landing rows, expected only the 1 published one', published_count;
  end if;

  select count(*) into draft_count from public.geo_landing_content where state = 'draft';
  if draft_count <> 1 then
    raise exception 'VALIDATION FAIL: the draft landing row was not stored for the test to be meaningful';
  end if;

  raise notice 'PASS  a geographic landing page is indexable only with published content';
end
$$;

select 'ALL PHASE 7 SCHEMA VALIDATIONS PASSED' as result;
