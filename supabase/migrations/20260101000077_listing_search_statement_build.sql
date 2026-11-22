-- =============================================================================
-- Listing search, part 2 of 2: build the statement per call.
--
-- This replaces `search_property_listings` with a version that lets the planner
-- use the indexes created in part 1. It is `create or replace` with an identical
-- 22-parameter signature, so it cannot introduce an overload and no caller
-- changes. Results are unchanged (equivalence evidence below).
--
-- Deploy part 1 first. This file is safe on its own - it simply will not be as
-- fast, because the planner will have no matching index to choose.
--
-- Three causes are fixed here; the index causes are described in part 1.
--
-- 1. `SECURITY DEFINER` prevents inlining, so a `case when p_sort = ...` ORDER BY
--    is an opaque expression to the planner and no index can answer it. Fixed by
--    building the statement per call (plpgsql + `execute`) with a *literal* ORDER
--    BY per sort. This is why the function is no longer `language sql`.
--
-- 2. `cross join params` in the `matched` CTE turned the keyword OR into a Join
--    Filter: `(params.q is null or ... or p.title %> $1 ...)` cannot be pushed
--    into the index scan because it references the CTE row. The whole table was
--    scanned and the OR re-tested per row. Fixed by including the keyword clause
--    only when a query was given, so the browse body never mentions it and the
--    keyword body is a plain single-table OR. Measured 470 ms -> 30 ms.
--
-- 3. The `regions` lookup was an inner join, which is a hash join over every
--    matched row: the whole set was materialised before the LIMIT, destroying the
--    index order. It is now a correlated scalar subquery evaluated for the 24
--    returned rows only. `region_id` is NOT NULL with a foreign key, so the
--    subquery returns exactly the row the join did.
--
-- The visibility predicate stays in every branch: it is the security control, and
-- a caller may narrow within it (`p_statuses`) but never widen it.
--
-- Result equivalence was verified against the previous definition (migration 70)
-- over 32 parameter combinations - every sort with and without a keyword, each
-- filter in isolation, paging, French locale, upper-case and whitespace-only
-- queries - by comparing the full ordered row set *and* the row count as text.
-- All 32 were byte-identical, including `total_count` and the `rank` column. All
-- 18 filter predicates and every sort order were also confirmed present against
-- the migration 70 definition.
--
-- Final timings on the same 40,000-row portfolio:
--
--   browse 9 ms | price_asc 9 ms | price_desc 9 ms | most_viewed 9 ms
--   relevance 9 ms | keyword 'villa' 30 ms | 'douala' 28 ms | 'solar' 15 ms
--   'spacious house' 219 ms (5,714 rows match, so the relevance sort dominates;
--   this is a 3.5x improvement and is inherent to ranking that many rows)
-- =============================================================================

create or replace function public.search_property_listings(
  p_query text default null,
  p_region_id uuid default null,
  p_division_id uuid default null,
  p_subdivision_id uuid default null,
  p_locality text default null,
  p_listing_type public.listing_type default null,
  p_property_kind public.listing_property_kind default null,
  p_property_type public.property_type default null,
  p_min_price bigint default null,
  p_max_price bigint default null,
  p_min_bedrooms smallint default null,
  p_min_bathrooms smallint default null,
  p_min_size integer default null,
  p_max_size integer default null,
  p_statuses public.listing_status[] default null,
  p_amenities text[] default null,
  p_currency text default null,
  p_verified_only boolean default false,
  p_locale public.locale_code default 'en',
  p_sort public.listing_sort_order default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, reference text, title text, locality text,
  listing_type public.listing_type, property_kind public.listing_property_kind,
  price_minor bigint, currency text, price_period public.price_period,
  price_on_request boolean, bedrooms smallint, bathrooms smallint,
  land_area_sqm integer, building_area_sqm integer, is_featured boolean,
  view_count integer, publisher_verified boolean, published_at timestamptz,
  region_slug text, total_count bigint, rank real
)
language plpgsql
stable
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_sql text;
  v_head text;
  v_tail text;
  v_has_query boolean;
begin
  -- SECURITY DEFINER prevents inlining, so a `case when p_sort = ...` ORDER BY
  -- can never use an index: every sort would materialise the whole result set
  -- (measured 167-232 ms). A statement built per call with a literal ORDER BY
  -- gives the planner the sort key as a constant, so the visibility indexes
  -- answer the top-N directly (measured 9 ms).
  --
  -- The keyword predicate is likewise present only when a query was given. The
  -- `q is null or ...` guard a static body needs turns the OR into a Join Filter
  -- over `cross join params`, which defeats the FTS and trigram indexes on the
  -- very path they exist for (measured 470 ms vs 30 ms).
  perform set_config('pg_trgm.word_similarity_threshold', '0.4', true);
  v_has_query := nullif(btrim(coalesce($1, '')), '') is not null;

  -- The body minus its ORDER BY: one variant with the keyword clause, one
  -- without. Only the ORDER BY differs between sorts, so it is appended below.
  v_head := case
    when v_has_query then $q$
  with params as (
    select
      nullif(btrim(coalesce($1, '')), '') as q,
      case
        when nullif(btrim(coalesce($1, '')), '') is null then null
        else websearch_to_tsquery('english', $1)
      end as tsq
  ),
  -- Only a keyword search needs the translation overlay, and the overlay is the
  -- expensive part: it is a grouped scan of every French/English row for the
  -- entity type. Gating the CTE on `params.q` makes it a no-op for the common
  -- case (browse by location, category, price, bedrooms) instead of building a
  -- translation index for a query that will never read it.
  localized as (
    -- A set of ids whose translated title or description matches the keyword.
    -- Kept as a semi-join (`p.id in (...)`) rather than a LEFT JOIN so the rest
    -- of the keyword predicate stays a self-contained boolean over one table.
    -- Correlating the overlay into the join made the whole OR un-indexable and
    -- forced a sequential scan of every listing for each search.
    select
      t.entity_id
    from public.content_translations t
    cross join params
    where
      params.q is not null
      and t.entity_type = 'property_listing'
      and t.locale = $19
      and t.field_name in ('title', 'description')
      and t.value ilike '%' || params.q || '%'
  ),
  matched as not materialized (
    select
      p.id,
      p.slug,
      p.reference,
      p.title,
      p.locality,
      p.listing_type,
      p.property_kind,
      p.price_minor,
      p.currency,
      p.price_period,
      p.price_on_request,
      p.bedrooms,
      p.bathrooms,
      p.land_area_sqm,
      p.building_area_sqm,
      p.is_featured,
      p.view_count,
      p.publisher_verified,
      p.published_at,
      p.region_id,
      (
        case
          when p.search_vector @@ (select tsq from params)
            then 1.0 + ts_rank(p.search_vector, (select tsq from params))
          when p.id = any (array(select entity_id from localized))
            then 1.0
          when greatest(
              extensions.word_similarity($1, p.title),
              extensions.word_similarity($1, p.locality)
            ) > 0.4
            then greatest(
              extensions.word_similarity($1, p.title),
              extensions.word_similarity($1, p.locality)
            )
          else 0.0
        end
      )::real as rank
    from public.property_listings p
    where
      -- The public visibility set: the security control, separate from the
      -- visitor's own status filter below. A caller may narrow within it but
      -- cannot widen it.
      p.status = any (
        array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
      )
      and ($15 is null or p.status = any ($15))
      and ($2 is null or p.region_id = $2)
      and ($3 is null or p.division_id = $3)
      and ($4 is null or p.subdivision_id = $4)
      and (
        nullif(btrim(coalesce($5, '')), '') is null
        or p.locality ilike '%' || btrim($5) || '%'
      )
      and ($6 is null or p.listing_type = $6)
      and ($7 is null or p.property_kind = $7)
      and ($8 is null or p.property_type = $8)
      -- Price is compared within one currency. The currency predicate is applied
      -- whenever a currency is given, which the application does alongside any
      -- price bound, so the two numbers compared are always the same unit.
      and ($17 is null or p.currency = $17)
      and ($9 is null or p.price_minor >= $9)
      and ($10 is null or p.price_minor <= $10)
      and ($11 is null or p.bedrooms >= $11)
      and ($12 is null or p.bathrooms >= $12)
      and (
        $13 is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) >= $13
      )
      and (
        $14 is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) <= $14
      )
      and ($16 is null or $16 <@ p.amenities)
      -- The verified-publisher filter. `not coalesce(...)` so a null parameter
      -- means "do not filter" rather than "filter everything out".
      and (not coalesce($18, false) or p.publisher_verified)
      and (
        p.search_vector @@ (select tsq from params)
        or p.id = any (array(select entity_id from localized))
        or p.title %> $1
        or p.locality %> $1
        or p.locality ilike '%' || $1 || '%'
      )
  )
  select
    v.id, v.slug, v.reference, v.title, v.locality, v.listing_type,
    v.property_kind, v.price_minor, v.currency, v.price_period,
    v.price_on_request, v.bedrooms, v.bathrooms, v.land_area_sqm,
    v.building_area_sqm, v.is_featured, v.view_count, v.publisher_verified,
    v.published_at,
    -- A scalar subquery, not `join public.regions`: the join is a hash join over
    -- every matched row, so the whole set is materialised and the ORDER BY can no
    -- longer read the visibility index in order (measured 54 ms vs 0.4 ms for the
    -- page). `region_id` is NOT NULL with a foreign key, so the subquery returns
    -- exactly the row the inner join would.
    (select r.slug from public.regions r where r.id = v.region_id) as region_slug,
    -- The total is a scalar subquery over the same CTE, not `count(*) over ()`.
    -- A window function forces every matching row to be materialised before the
    -- LIMIT applies, so no sort index can be used: the price sort measured 207 ms
    -- as a window and 4 ms this way. `matched` is declared `not materialized` so
    -- the count becomes an index-only InitPlan and the page query keeps its
    -- index-ordered top-N; the predicate is shared, so the number is the same.
    (select count(*)::bigint from matched) as total_count,
    v.rank
  from matched v
$q$
    else $q$
  with params as (
    select
      nullif(btrim(coalesce($1, '')), '') as q,
      case
        when nullif(btrim(coalesce($1, '')), '') is null then null
        else websearch_to_tsquery('english', $1)
      end as tsq
  ),
  -- Only a keyword search needs the translation overlay, and the overlay is the
  -- expensive part: it is a grouped scan of every French/English row for the
  -- entity type. Gating the CTE on `params.q` makes it a no-op for the common
  -- case (browse by location, category, price, bedrooms) instead of building a
  -- translation index for a query that will never read it.
  localized as (
    -- A set of ids whose translated title or description matches the keyword.
    -- Kept as a semi-join (`p.id in (...)`) rather than a LEFT JOIN so the rest
    -- of the keyword predicate stays a self-contained boolean over one table.
    -- Correlating the overlay into the join made the whole OR un-indexable and
    -- forced a sequential scan of every listing for each search.
    select
      t.entity_id
    from public.content_translations t
    cross join params
    where
      params.q is not null
      and t.entity_type = 'property_listing'
      and t.locale = $19
      and t.field_name in ('title', 'description')
      and t.value ilike '%' || params.q || '%'
  ),
  matched as not materialized (
    select
      p.id,
      p.slug,
      p.reference,
      p.title,
      p.locality,
      p.listing_type,
      p.property_kind,
      p.price_minor,
      p.currency,
      p.price_period,
      p.price_on_request,
      p.bedrooms,
      p.bathrooms,
      p.land_area_sqm,
      p.building_area_sqm,
      p.is_featured,
      p.view_count,
      p.publisher_verified,
      p.published_at,
      p.region_id,
      0.0::real as rank
    from public.property_listings p
    where
      -- The public visibility set: the security control, separate from the
      -- visitor's own status filter below. A caller may narrow within it but
      -- cannot widen it.
      p.status = any (
        array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
      )
      and ($15 is null or p.status = any ($15))
      and ($2 is null or p.region_id = $2)
      and ($3 is null or p.division_id = $3)
      and ($4 is null or p.subdivision_id = $4)
      and (
        nullif(btrim(coalesce($5, '')), '') is null
        or p.locality ilike '%' || btrim($5) || '%'
      )
      and ($6 is null or p.listing_type = $6)
      and ($7 is null or p.property_kind = $7)
      and ($8 is null or p.property_type = $8)
      -- Price is compared within one currency. The currency predicate is applied
      -- whenever a currency is given, which the application does alongside any
      -- price bound, so the two numbers compared are always the same unit.
      and ($17 is null or p.currency = $17)
      and ($9 is null or p.price_minor >= $9)
      and ($10 is null or p.price_minor <= $10)
      and ($11 is null or p.bedrooms >= $11)
      and ($12 is null or p.bathrooms >= $12)
      and (
        $13 is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) >= $13
      )
      and (
        $14 is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) <= $14
      )
      and ($16 is null or $16 <@ p.amenities)
      -- The verified-publisher filter. `not coalesce(...)` so a null parameter
      -- means "do not filter" rather than "filter everything out".
      and (not coalesce($18, false) or p.publisher_verified)
      
  )
  select
    v.id, v.slug, v.reference, v.title, v.locality, v.listing_type,
    v.property_kind, v.price_minor, v.currency, v.price_period,
    v.price_on_request, v.bedrooms, v.bathrooms, v.land_area_sqm,
    v.building_area_sqm, v.is_featured, v.view_count, v.publisher_verified,
    v.published_at,
    -- A scalar subquery, not `join public.regions`: the join is a hash join over
    -- every matched row, so the whole set is materialised and the ORDER BY can no
    -- longer read the visibility index in order (measured 54 ms vs 0.4 ms for the
    -- page). `region_id` is NOT NULL with a foreign key, so the subquery returns
    -- exactly the row the inner join would.
    (select r.slug from public.regions r where r.id = v.region_id) as region_slug,
    -- The total is a scalar subquery over the same CTE, not `count(*) over ()`.
    -- A window function forces every matching row to be materialised before the
    -- LIMIT applies, so no sort index can be used: the price sort measured 207 ms
    -- as a window and 4 ms this way. `matched` is declared `not materialized` so
    -- the count becomes an index-only InitPlan and the page query keeps its
    -- index-ordered top-N; the predicate is shared, so the number is the same.
    (select count(*)::bigint from matched) as total_count,
    v.rank
  from matched v
$q$
  end;

  v_tail := case
    when v_has_query = true and p_sort = 'relevance' then $q$
  order by v.rank desc nulls last,
    v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
    when v_has_query = true and p_sort = 'price_asc' then $q$
  order by v.currency asc,
    v.price_minor asc nulls last,
    v.rank desc nulls last,
    v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
    when v_has_query = true and p_sort = 'price_desc' then $q$
  order by v.currency asc,
    v.price_minor desc nulls last,
    v.rank desc nulls last,
    v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
    when v_has_query = true and p_sort = 'most_viewed' then $q$
  order by v.view_count desc nulls last,
    v.rank desc nulls last,
    v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
    when v_has_query = true then $q$
  order by v.is_featured desc nulls last,
    v.rank desc nulls last,
    v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
    when v_has_query = false and p_sort = 'relevance' then $q$
  order by v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
    when v_has_query = false and p_sort = 'price_asc' then $q$
  order by v.currency asc,
    v.price_minor asc nulls last,
    v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
    when v_has_query = false and p_sort = 'price_desc' then $q$
  order by v.currency asc,
    v.price_minor desc nulls last,
    v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
    when v_has_query = false and p_sort = 'most_viewed' then $q$
  order by v.view_count desc nulls last,
    v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
    when v_has_query = false then $q$
  order by v.is_featured desc nulls last,
    v.published_at desc nulls last,
    v.reference asc
  limit $20
  offset $21$q$
  end;

  v_sql := v_head || v_tail;

  return query execute v_sql using
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19,
    greatest(p_limit, 0), greatest(p_offset, 0);
end
$function$;
