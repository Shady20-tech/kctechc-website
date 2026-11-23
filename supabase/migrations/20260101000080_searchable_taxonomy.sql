-- =============================================================================
-- Make the taxonomy searchable, so "land" finds land.
--
-- Reported defect: a visitor typed "land" into the marketplace search and was
-- told "No properties match your filters", while browsing the same page listed
-- land. The listings existed; the keyword could not reach them.
--
-- Cause: `property_listings.search_vector` was generated from `title`,
-- `description`, `locality` and `highlights` only. The columns that *classify* a
-- listing - `property_kind`, `listing_type`, `property_type` - were in no search
-- path at all: not the vector, not the trigram arms (title and locality only),
-- not `locality ilike`. So the taxonomy was unfilterable by keyword. "land"
-- matched only a listing whose *prose* happened to contain the word, and a
-- listing titled "Titled plot in Buea" with `property_kind = 'land'` was
-- unreachable by a search for "land".
--
-- That is the opposite of how a marketplace is used. Visitors search in nouns -
-- "land", "house", "apartment", "shop", "for rent" - and expect the category to
-- match rather than having to guess the wording of the advert.
--
-- Two changes, both additive:
--
--   1. The generated vector now includes the three taxonomy columns as text.
--      Underscores become spaces, so `short_term` is searchable as "short term"
--      and `mixed_use` as "mixed use". This alone makes every enum value a
--      keyword that finds its own rows.
--
--   2. The keyword predicate gains a synonym arm for the words a visitor uses
--      that are not the stored enum value: "plot", "parcel", "terrain",
--      "parcelle" for land; "maison" for house; "flat" for apartment;
--      "boutique" for shop; "a vendre" for sale. French is included because the
--      site serves both locales and `property_kind` is an enum value with no
--      translation overlay to search.
--
-- Nothing is removed from the existing predicate. A keyword still matches title,
-- description, locality, highlights and the translation overlay exactly as
-- before; the taxonomy arms are additional ORs. A search that returned results
-- before returns the same results plus any listing whose category matches.
--
-- The synonym list is inline rather than a new table or function: it is product
-- vocabulary that must be reviewable in a diff, it needs no index, and keeping
-- it inside the `security definer` function avoids creating a function that the
-- Phase 12 EXECUTE allow-list would then have to classify.
--
-- The signature is unchanged, so this is a `create or replace` and the browser
-- grant from Phase 12 still applies. `drop function` is deliberately NOT used:
-- it would drop the ACL and the listings page would stop working.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rebuild the search vector to include the taxonomy.
--
-- A generated column cannot be altered in place, so it is dropped and re-added.
-- Dropping it drops `property_listings_search_idx` (the index depends on the
-- column); the index is recreated below. No other index, constraint or view
-- references `search_vector` - verified against every migration before writing
-- this.
-- -----------------------------------------------------------------------------
alter table public.property_listings
  drop column if exists search_vector;

alter table public.property_listings
  add column search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' '
      || coalesce(locality, '') || ' '
      || public.immutable_array_to_string(highlights) || ' '
      -- The taxonomy. `replace` turns an enum value into the phrase a person
      -- types: `short_term` becomes "short term". Without it the vector would
      -- hold "short_term", which `websearch_to_tsquery('english', 'short term')`
      -- does not match.
      || replace(property_kind::text, '_', ' ') || ' '
      || replace(listing_type::text, '_', ' ') || ' '
      || replace(property_type::text, '_', ' ')
    )
  ) stored;

comment on column public.property_listings.search_vector is
  'Full-text vector over the prose fields and the taxonomy, so a keyword finds a listing by its category as well as by its wording. Generated; never written by the application.';

create index if not exists property_listings_search_idx
  on public.property_listings using gin (search_vector);

-- -----------------------------------------------------------------------------
-- 2. Add the synonym arm to the keyword predicate.
--
-- `create or replace` with the identical 22-parameter signature. Only the
-- keyword branch changes; the browse branch is carried over verbatim from
-- migration 77, including the currency-grouped price sort and the scalar
-- subqueries that keep the visibility index usable.
-- -----------------------------------------------------------------------------
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
  perform set_config('pg_trgm.word_similarity_threshold', '0.4', true);
  v_has_query := nullif(btrim(coalesce($1, '')), '') is not null;

  v_head := case
    when v_has_query then $q$
  -- The synonym vocabulary, resolved once per call into two scalars on `params`.
  -- Compared to the whole query, lower-cased and trimmed, so "land" resolves and
  -- "island" does not, and a multi-word query like "land buea" keeps its text
  -- search rather than silently becoming a category filter that ignores "buea".
  --
  -- Scalars, not a joined CTE: `cross join params` here is exactly what turned
  -- the keyword OR into an un-indexable Join Filter (migration 77). A scalar
  -- subquery is evaluated once and the predicate stays a plain single-table
  -- comparison, so the FTS and trigram indexes are still usable.
  with vocab as (
    select * from (values
      -- property kind, in the words a visitor uses (English and French).
      ('land'::text,        null::text, 'land'),
      ('land',              null,       'lands'),
      ('land',              null,       'plot'),
      ('land',              null,       'plots'),
      ('land',              null,       'parcel'),
      ('land',              null,       'parcels'),
      ('land',              null,       'terrain'),
      ('land',              null,       'terrains'),
      ('land',              null,       'parcelle'),
      ('land',              null,       'parcelles'),
      ('farm',              null,       'farm'),
      ('farm',              null,       'ferme'),
      ('house',             null,       'house'),
      ('house',             null,       'home'),
      ('house',             null,       'maison'),
      ('warehouse',         null,       'entrepôt'),
      ('house',             null,       'bungalow'),
      ('apartment',         null,       'apartment'),
      ('apartment',         null,       'flat'),
      ('apartment',         null,       'appartement'),
      ('villa',             null,       'villa'),
      ('duplex',            null,       'duplex'),
      ('studio',            null,       'studio'),
      ('office',            null,       'office'),
      ('office',            null,       'bureau'),
      ('shop',              null,       'shop'),
      ('shop',              null,       'boutique'),
      ('shop',              null,       'store'),
      ('warehouse',         null,       'warehouse'),
      ('warehouse',         null,       'entrepot'),
      ('hotel',             null,       'hotel'),
      ('guesthouse',        null,       'guesthouse'),
      ('guesthouse',        null,       'auberge'),
      ('restaurant',        null,       'restaurant'),
      -- listing type, which describes the offer rather than the building: the
      -- same villa can appear under both "sale" and "rent".
      (null,                'sale',     'sale'),
      (null,                'sale',     'buy'),
      (null,                'sale',     'vente'),
      (null,                'sale',     'vendre'),
      (null,                'sale',     'a vendre'),
      (null,                'sale',     'à vendre'),
      (null,                'rent',     'rent'),
      (null,                'rent',     'rental'),
      (null,                'rent',     'location'),
      (null,                'rent',     'louer'),
      (null,                'rent',     'a louer'),
      (null,                'rent',     'à louer'),
      (null,                'lease',    'lease'),
      (null,                'lease',    'bail'),
      (null,                'short_term', 'short term'),
      (null,                'short_term', 'airbnb')
    ) as v(kind, listing_type, term)
  ),
  params as (
    select
      nullif(btrim(coalesce($1, '')), '') as q,
      case
        when nullif(btrim(coalesce($1, '')), '') is null then null
        else websearch_to_tsquery('english', $1)
      end as tsq,
      (
        select v.kind from vocab v
        where v.term = lower(btrim($1)) and v.kind is not null
        limit 1
      ) as syn_kind,
      (
        select v.listing_type from vocab v
        where v.term = lower(btrim($1)) and v.listing_type is not null
        limit 1
      ) as syn_listing_type,
      -- A place name typed into the keyword box. "Southwest", "Fako" and "Limbe"
      -- are region, division and subdivision names; none of them is a listing
      -- column, so before this they were unsearchable unless the advert happened
      -- to repeat the name in its locality text. Resolved once per call into ids,
      -- so the predicate below is a plain `p.region_id = ...` comparison that can
      -- use an index, not a correlated name lookup per row.
      (
        select r.id from public.regions r
        where lower(r.name) = lower(btrim($1))
           or lower(coalesce(r.name_fr, '')) = lower(btrim($1))
           or r.slug = lower(btrim($1))
        limit 1
      ) as geo_region_id,
      (
        select d.id from public.divisions d
        where lower(d.name) = lower(btrim($1))
           or lower(coalesce(d.name_fr, '')) = lower(btrim($1))
           or d.slug = lower(btrim($1))
        limit 1
      ) as geo_division_id,
      (
        select sd.id from public.subdivisions sd
        where lower(sd.name) = lower(btrim($1))
           or lower(coalesce(sd.name_fr, '')) = lower(btrim($1))
           or sd.slug = lower(btrim($1))
        limit 1
      ) as geo_subdivision_id
  ),
  localized as (
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
          when p.property_kind::text = (select syn_kind from params)
            or p.listing_type::text = (select syn_listing_type from params)
            then 1.0
          when p.region_id = (select geo_region_id from params)
            or p.division_id = (select geo_division_id from params)
            or p.subdivision_id = (select geo_subdivision_id from params)
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
        -- The taxonomy is inside `search_vector` now, so a bare category word
        -- ("land", "house", "for rent") is answered by the vector arm alone.
        p.search_vector @@ (select tsq from params)
        or p.id = any (array(select entity_id from localized))
        -- The synonym arm, for the words that are not the stored enum value.
        -- A null synonym compares as null, which is not true, so an unresolved
        -- query adds no rows.
        or p.property_kind::text = (select syn_kind from params)
        or p.listing_type::text = (select syn_listing_type from params)
        -- A place name typed into the keyword box. Null ids compare as null and
        -- add no rows, so a query that names no place is unaffected.
        or p.region_id = (select geo_region_id from params)
        or p.division_id = (select geo_division_id from params)
        or p.subdivision_id = (select geo_subdivision_id from params)
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
    -- longer read the visibility index in order. `region_id` is NOT NULL with a
    -- foreign key, so the subquery returns exactly the row the inner join would.
    (select r.slug from public.regions r where r.id = v.region_id) as region_slug,
    -- The total is a scalar subquery over the same CTE, not `count(*) over ()`.
    -- A window function forces every matching row to be materialised before the
    -- LIMIT applies, so no sort index can be used. `matched` is `not
    -- materialized`, so the count becomes an index-only InitPlan and the page
    -- query keeps its index-ordered top-N; the predicate is shared, so the number
    -- is the same.
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
  -- case (browse by location, category, price, bedrooms).
  localized as (
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
    (select r.slug from public.regions r where r.id = v.region_id) as region_slug,
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
    else $q$
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
    -- Clamped as migration 77 did: a negative limit or offset would be a SQL
    -- error rather than an empty page.
    greatest(p_limit, 0), greatest(p_offset, 0);
end
$function$;

comment on function public.search_property_listings is
  'The public listings query engine: AND-combined structured filters, a currency-scoped price filter and price sort, a verified-publisher filter, localized keyword match over prose and taxonomy, total count and pagination in one round trip. Published listings only.';

-- `create or replace` preserves the ACL, so the Phase 12 browser grant survives.
-- Restated only to document that it does.
grant execute on function public.search_property_listings(
  text, uuid, uuid, uuid, text,
  public.listing_type, public.listing_property_kind, public.property_type,
  bigint, bigint, smallint, smallint, integer, integer,
  public.listing_status[], text[], text, boolean,
  public.locale_code, public.listing_sort_order, integer, integer
) to anon, authenticated;
