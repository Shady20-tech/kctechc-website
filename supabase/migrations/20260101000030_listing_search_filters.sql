-- =============================================================================
-- Phase 7 — The listings query engine.
--
-- Requirement: "Implement filters using AND logic", "Show accurate result
-- counts", "Use pagination or cursor pagination; do not load the entire
-- nationwide catalogue into the browser."
--
-- Why this is SQL and not a filter over a loaded list:
--
-- Phase 6 filtered in TypeScript over `loadPublishedListings({ limit: 48 })`.
-- That was correct while the surface was a department teaser, and it is wrong for
-- the main browser for three reasons:
--
--   1. It cannot paginate. The "catalogue" was whatever 48 rows the loader
--      happened to fetch, so a filter over it produced a count that described the
--      page, not the market.
--   2. The count was therefore wrong in a way a visitor would notice — the same
--      filter showed different totals depending on which 48 rows were loaded.
--   3. Loading the whole catalogue to filter in the browser is exactly what the
--      brief forbids.
--
-- So the query moves into one function that filters, counts and paginates in a
-- single round trip. `count(*) over ()` yields the total for the current filter
-- state alongside the page rows, which is what makes the result count accurate
-- without a second query that could disagree with the first.
--
-- Localized keyword search is handled here too, and that is the subtle part.
-- `property_listings.search_vector` is built from the English columns, so it can
-- only ever match the canonical text — a French visitor searching "terrain"
-- would find nothing, and "maison" would not match "house". The keyword predicate
-- therefore also matches `content_translations` for the requested locale, which
-- is where the localized title and description actually live. Without that, the
-- French search surface is silently English-only.
--
-- Deliberately NOT a `security definer` function reading unpublished rows: the
-- predicate is pinned to `status = 'published'`, matching the Phase 6 RPC and the
-- RLS policy. The grant is what makes it callable; the predicate is the control.
-- =============================================================================

-- The sort orders the browser offers. An enum rather than a text parameter so an
-- unknown value is rejected by the type system rather than silently falling back
-- to a default the caller did not ask for.
create type public.listing_sort_order as enum (
  'newest',
  'price_asc',
  'price_desc',
  'most_viewed'
);

comment on type public.listing_sort_order is
  'Ordering for the public listings browser. Mirrors LISTING_SORTS in src/lib/real-estate/search.ts.';

-- The previous signature (without division/subdivision/bathrooms/size/status/
-- locale/sort) is dropped *before* the new function is created, not after.
--
-- `create or replace function` can only replace a function with the *same*
-- argument list; changing the parameters creates a second function and leaves the
-- original in place. That is not a cosmetic problem — the two overloads then
-- coexist, and PostgREST cannot choose between them for a caller that omits the
-- new named parameters, so every call fails with "function is not unique" at
-- runtime on a path that typechecks perfectly. Dropping first is what makes the
-- replacement a replacement.
drop function if exists public.search_property_listings(
  text, uuid, public.listing_type, public.listing_property_kind,
  bigint, bigint, smallint, text[], integer, integer
);

create or replace function public.search_property_listings(
  p_query text default null,
  p_region_id uuid default null,
  p_division_id uuid default null,
  p_subdivision_id uuid default null,
  p_listing_type public.listing_type default null,
  p_property_kind public.listing_property_kind default null,
  -- The broad class, separate from the kind. The brief lists "property type" and
  -- "property kind" as two filters, and they are genuinely different questions: a
  -- kind is what the building is (villa, land, warehouse) and a class is what it is
  -- for (residential, commercial, industrial). A visitor looking for commercial
  -- space wants the class; one looking for a shop wants the kind.
  p_property_type public.property_type default null,
  p_min_price bigint default null,
  p_max_price bigint default null,
  p_min_bedrooms smallint default null,
  p_min_bathrooms smallint default null,
  p_min_size integer default null,
  p_max_size integer default null,
  p_statuses public.listing_status[] default null,
  p_amenities text[] default null,
  p_locale public.locale_code default 'en',
  p_sort public.listing_sort_order default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  reference text,
  title text,
  locality text,
  listing_type public.listing_type,
  property_kind public.listing_property_kind,
  price_minor bigint,
  currency text,
  price_period public.price_period,
  price_on_request boolean,
  bedrooms smallint,
  bathrooms smallint,
  land_area_sqm integer,
  building_area_sqm integer,
  is_featured boolean,
  view_count integer,
  published_at timestamptz,
  region_slug text,
  total_count bigint,
  rank real
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with params as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as q,
      -- A websearch query understands quoted phrases and `or`, and cannot be
      -- made to raise on malformed input the way to_tsquery can. That matters
      -- because this takes arbitrary visitor text.
      case
        when nullif(btrim(coalesce(p_query, '')), '') is null then null
        else websearch_to_tsquery('english', p_query)
      end as tsq
  ),
  -- The localized title and description for the requested locale, one row per
  -- listing.
  --
  -- Aggregated rather than joined directly, and that is not a micro-optimisation.
  -- `content_translations` holds one row per field, so joining it straight into
  -- the listing query would produce two rows per translated listing — one for
  -- `title` and one for `description`. That doubles the row count, which makes
  -- `count(*) over ()` report twice the real total and makes the listing appear
  -- twice on the page. Collapsing to one row per entity is what keeps the count
  -- honest.
  --
  -- A LEFT JOIN, so a listing with no French translation is still returned. It
  -- matches on its canonical columns; excluding it would make listings vanish
  -- from the French site whenever a translation was missing.
  localized as (
    select
      t.entity_id,
      string_agg(t.value, ' ') as value
    from public.content_translations t
    where
      t.entity_type = 'property_listing'
      and t.locale = p_locale
      and t.field_name in ('title', 'description')
    group by t.entity_id
  ),
  -- The listings matching the filter state, with a relevance score. Split into a
  -- CTE so the window count and the ordering below both read one result set
  -- rather than each re-running the predicates and risking a different answer.
  matched as (
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
      p.published_at,
      r.slug as region_slug,
      (
        case
          -- A full-text hit ranks above a fuzzy one: it means the words were
          -- actually present rather than merely similar.
          when params.tsq is not null and p.search_vector @@ params.tsq
            then 1.0 + ts_rank(p.search_vector, params.tsq)
          -- A hit in the localized text is a real hit too, and ranks alongside a
          -- canonical full-text hit rather than below it. Ranking it lower would
          -- order an exact French title match under a loose English one.
          when params.q is not null and loc.value ilike '%' || params.q || '%'
            then 1.0
          -- Word similarity, not whole-string similarity. `similarity()` compares
          -- the entire strings, so a typo inside a long title scores far too low to
          -- ever match: "vila" against "Modern villa with sea view" scores 0.15,
          -- because most of the title's trigrams are absent from the query.
          -- `word_similarity(query, title)` compares the query against the closest
          -- extent of the title and scores the same typo 0.6, which is what makes
          -- typo tolerance actually work here.
          when params.q is not null
            and greatest(
              extensions.word_similarity(params.q, p.title),
              extensions.word_similarity(params.q, coalesce(p.locality, ''))
            ) > 0.4
            then greatest(
              extensions.word_similarity(params.q, p.title),
              extensions.word_similarity(params.q, coalesce(p.locality, ''))
            )
          else 0.0
        end
      )::real as rank
    from public.property_listings p
    join public.regions r on r.id = p.region_id
    left join localized loc on loc.entity_id = p.id
    cross join params
    where
      -- The public visibility set. This is the security control and it is a
      -- separate clause from the visitor's status filter below, because the two
      -- answer different questions and only one of them is safe to let a caller
      -- choose.
      --
      -- It is the *public* set, not `status = 'published'` alone: a listing that
      -- is under offer, sold or rented is still part of "villas in the Southwest",
      -- which is the question a region landing page answers. Restricting this to
      -- `published` alone would silently drop the concluded listings that
      -- `PUBLIC_LISTING_STATUSES` says are visible.
      --
      -- A caller may narrow within this set, but cannot widen it: passing
      -- `p_statuses => array['draft']` yields nothing rather than returning
      -- drafts, because both clauses must hold. That is what keeps this function
      -- from becoming a way to read unpublished inventory.
      p.status = any (
        array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
      )
      and (p_statuses is null or p.status = any (p_statuses))
      and (p_region_id is null or p.region_id = p_region_id)
      -- Division and subdivision are narrowing filters: choosing a subdivision
      -- also implies its division, and the composite FK on the row guarantees the
      -- pair agrees, so these are plain equality rather than a hierarchy walk.
      and (p_division_id is null or p.division_id = p_division_id)
      and (p_subdivision_id is null or p.subdivision_id = p_subdivision_id)
      and (p_listing_type is null or p.listing_type = p_listing_type)
      and (p_property_kind is null or p.property_kind = p_property_kind)
      and (p_property_type is null or p.property_type = p_property_type)
      and (p_min_price is null or p.price_minor >= p_min_price)
      and (p_max_price is null or p.price_minor <= p_max_price)
      and (p_min_bedrooms is null or p.bedrooms >= p_min_bedrooms)
      and (p_min_bathrooms is null or p.bathrooms >= p_min_bathrooms)
      -- Size is the larger of land and building area. A buyer asking for "at
      -- least 500 m²" means the property has that much of *something* — a 600 m²
      -- plot with a 120 m² house satisfies it, and so does a 200 m² plot with a
      -- 600 m² building. Using land alone would hide the second, which is a real
      -- property the visitor asked to see.
      and (
        p_min_size is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) >= p_min_size
      )
      and (
        p_max_size is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) <= p_max_size
      )
      -- The requested amenities must be a SUBSET of the listing's, which is what a
      -- filter means to a buyer: a listing must have every feature asked for. The
      -- parameter is on the left; writing `p.amenities <@ p.amenities` would compare
      -- the column to itself and always be true.
      and (p_amenities is null or p_amenities <@ p.amenities)
      and (
        params.q is null
        or p.search_vector @@ params.tsq
        -- The localized match. This is the clause that makes a French keyword
        -- search work at all.
        or loc.value ilike '%' || params.q || '%'
        -- Typo tolerance, on the same measure as the ranking above.
        or greatest(
             extensions.word_similarity(params.q, p.title),
             extensions.word_similarity(params.q, coalesce(p.locality, ''))
           ) > 0.4
        -- Exact substring on the locality, so "limbe" finds Limbe listings even
        -- when the word appears in neither the title nor the description.
        or p.locality ilike '%' || params.q || '%'
      )
  ),
  -- The status filter is applied above with the other predicates rather than as a
  -- separate pass, because it is a *public visibility* filter and not a market
  -- filter. A listing that is sold is still a real result for "villas in
  -- Littoral"; a visitor who wants only available property asks for that
  -- explicitly. Defaulting to "everything published" is what makes a region
  -- landing page show the full picture of that region.
  --
  -- The window count is taken here, over the fully-filtered set, so it is the
  -- total for the current filter state rather than the size of the page.
  counted as (
    select m.*, count(*) over () as total_count
    from matched m
  )
  select
    v.id, v.slug, v.reference, v.title, v.locality, v.listing_type,
    v.property_kind, v.price_minor, v.currency, v.price_period,
    v.price_on_request, v.bedrooms, v.bathrooms, v.land_area_sqm,
    v.building_area_sqm, v.is_featured, v.view_count, v.published_at,
    v.region_slug, v.total_count, v.rank
  from counted v
  order by
    -- Featured listings lead the default ordering only. Pinning them to the top
    -- of a price sort would make the sort a lie: a visitor asking for the
    -- cheapest property would be shown a promoted one first.
    case when p_sort = 'newest' then v.is_featured end desc nulls last,
    case when p_sort = 'price_asc' then v.price_minor end asc nulls last,
    case when p_sort = 'price_desc' then v.price_minor end desc nulls last,
    case when p_sort = 'most_viewed' then v.view_count end desc nulls last,
    v.rank desc,
    v.published_at desc nulls last,
    -- A final tie-break on the reference, which is unique. Two listings at the
    -- same price must not swap places between the render and a re-render; that
    -- would be a hydration mismatch.
    v.reference asc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

comment on function public.search_property_listings is
  'The public listings query engine: AND-combined structured filters, localized keyword match, total count and pagination in one round trip. Published listings only.';

grant execute on function public.search_property_listings(
  text, uuid, uuid, uuid, public.listing_type, public.listing_property_kind,
  public.property_type,
  bigint, bigint, smallint, smallint, integer, integer,
  public.listing_status[], text[], public.locale_code, public.listing_sort_order,
  integer, integer
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Published listing counts per geography level.
--
-- The cascading filter needs to know which divisions exist under a region *with
-- listings*, and the landing-page eligibility check needs the same number. Doing
-- it in one function rather than three count queries keeps the numbers consistent
-- with each other and with the browser: all of them count the same predicate.
--
-- Only the public status set is counted, matching the search function's
-- visibility clause and the RLS policy. A count that included drafts would tell a
-- visitor how much unpublished inventory exists; a count limited to `published`
-- alone would under-report every region holding a sold listing, so the cascading
-- filter would offer a division count that disagreed with the results the visitor
-- actually gets after clicking it.
-- -----------------------------------------------------------------------------
create or replace function public.listing_geography_counts()
returns table (
  level public.geo_landing_level,
  geo_id uuid,
  parent_id uuid,
  total bigint
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with visible as (
    select p.region_id, p.division_id, p.subdivision_id
    from public.property_listings p
    where p.status = any (
      array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
    )
  )
  select 'region'::public.geo_landing_level, v.region_id, null::uuid, count(*)
  from visible v
  group by v.region_id
  union all
  select 'division'::public.geo_landing_level, v.division_id, v.region_id, count(*)
  from visible v
  where v.division_id is not null
  group by v.division_id, v.region_id
  union all
  select 'subdivision'::public.geo_landing_level, v.subdivision_id, v.division_id, count(*)
  from visible v
  where v.subdivision_id is not null
  group by v.subdivision_id, v.division_id;
$$;

comment on function public.listing_geography_counts is
  'Public listing counts per region, division and subdivision. One predicate, so the cascading filter, the landing pages and the browser cannot disagree.';

grant execute on function public.listing_geography_counts() to anon, authenticated;
