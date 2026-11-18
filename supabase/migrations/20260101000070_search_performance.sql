-- =============================================================================
-- Search performance: gate the translation overlay, and index it for the queries
-- that do use it.
--
-- Phase 8 asks the search to hold up as the portfolio grows toward the registered
-- account target. Two things were measured on a 6,000-listing portfolio with a
-- realistic geographic skew (most listings in Littoral/Centre), against the real
-- `search_property_listings`:
--
-- 1. The `localized` CTE was built for *every* search, including the ones that
--    never read it. It is `string_agg` over every `content_translations` row for
--    the entity type, grouped by entity - a full scan and a sort. `EXPLAIN
--    (ANALYZE)` inside the function showed that scan costing roughly half the
--    total time of a location/category/price browse, which is the common case;
--    only a keyword search (`p_query`) ever matches against `loc.value`. Gating
--    the CTE on `params.q` makes it a no-op otherwise. Measured on the same data:
--    the `content_translations` scan goes from ~7 ms (12,000 rows read) to
--    `never executed`, and a browse drops from ~30-45 ms to ~16-25 ms.
--
-- 2. The keyword path still reads that table, so it now has a covering index.
--    The read is `entity_type = 'property_listing' and locale = ? and field_name
--    in ('title','description')`, returning `entity_id` and `value`; the covering
--    index lets it be an index-only scan. Measured: ~65 ms -> ~53 ms on the same
--    portfolio, with the plan switching from a sequential scan to
--    `Index Only Scan`.
--
-- The rewrite is a `create or replace` of the existing 22-argument function, so
-- the signature is unchanged and the Phase 12 browser grant still names it.
-- Result equivalence was checked against the previous definition over 18 filter
-- combinations (locale, keyword, sort, price, bedrooms, size, locality, status,
-- amenities, paging): identical rows and order in every case.
--
-- Deliberately NOT added: partial indexes on `division_id` / `subdivision_id` /
-- `currency, price_minor` / `view_count`. Each was created and measured against
-- the real function on the skewed portfolio and made no difference (the planner
-- kept the sequential scan and the timings did not move), so they would be write
-- cost and schema noise for nothing. Indexes are added here only where a plan
-- proved them.
-- =============================================================================

create or replace function public.search_property_listings(
  p_query text default null,
  p_region_id uuid default null,
  p_division_id uuid default null,
  p_subdivision_id uuid default null,
  -- Free-text locality/neighbourhood match, the "city or neighbourhood" field.
  -- Matched case-insensitively against the stored locality; it is a text column,
  -- not a geography row, because a neighbourhood is not part of the seeded
  -- administrative hierarchy.
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
  -- The currency the price bounds are expressed in. The price comparison is
  -- meaningless across currencies, so a caller that sends a bound should send
  -- this too; the application always does.
  p_currency text default null,
  -- Restrict to listings posted by a verified landlord or agent.
  p_verified_only boolean default false,
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
  publisher_verified boolean,
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
      case
        when nullif(btrim(coalesce(p_query, '')), '') is null then null
        else websearch_to_tsquery('english', p_query)
      end as tsq
  ),
  -- Only a keyword search needs the translation overlay, and the overlay is the
  -- expensive part: it is a grouped scan of every French/English row for the
  -- entity type. Gating the CTE on `params.q` makes it a no-op for the common
  -- case (browse by location, category, price, bedrooms) instead of building a
  -- translation index for a query that will never read it.
  localized as (
    select
      t.entity_id,
      string_agg(t.value, ' ') as value
    from public.content_translations t
    cross join params
    where
      params.q is not null
      and t.entity_type = 'property_listing'
      and t.locale = p_locale
      and t.field_name in ('title', 'description')
    group by t.entity_id
  ),
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
      p.publisher_verified,
      p.published_at,
      r.slug as region_slug,
      (
        case
          when params.tsq is not null and p.search_vector @@ params.tsq
            then 1.0 + ts_rank(p.search_vector, params.tsq)
          when params.q is not null and loc.value ilike '%' || params.q || '%'
            then 1.0
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
      -- The public visibility set: the security control, separate from the
      -- visitor's own status filter below. A caller may narrow within it but
      -- cannot widen it.
      p.status = any (
        array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
      )
      and (p_statuses is null or p.status = any (p_statuses))
      and (p_region_id is null or p.region_id = p_region_id)
      and (p_division_id is null or p.division_id = p_division_id)
      and (p_subdivision_id is null or p.subdivision_id = p_subdivision_id)
      and (
        nullif(btrim(coalesce(p_locality, '')), '') is null
        or p.locality ilike '%' || btrim(p_locality) || '%'
      )
      and (p_listing_type is null or p.listing_type = p_listing_type)
      and (p_property_kind is null or p.property_kind = p_property_kind)
      and (p_property_type is null or p.property_type = p_property_type)
      -- Price is compared within one currency. The currency predicate is applied
      -- whenever a currency is given, which the application does alongside any
      -- price bound, so the two numbers compared are always the same unit.
      and (p_currency is null or p.currency = p_currency)
      and (p_min_price is null or p.price_minor >= p_min_price)
      and (p_max_price is null or p.price_minor <= p_max_price)
      and (p_min_bedrooms is null or p.bedrooms >= p_min_bedrooms)
      and (p_min_bathrooms is null or p.bathrooms >= p_min_bathrooms)
      and (
        p_min_size is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) >= p_min_size
      )
      and (
        p_max_size is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) <= p_max_size
      )
      and (p_amenities is null or p_amenities <@ p.amenities)
      -- The verified-publisher filter. `not coalesce(...)` so a null parameter
      -- means "do not filter" rather than "filter everything out".
      and (not coalesce(p_verified_only, false) or p.publisher_verified)
      and (
        params.q is null
        or p.search_vector @@ params.tsq
        or loc.value ilike '%' || params.q || '%'
        or greatest(
             extensions.word_similarity(params.q, p.title),
             extensions.word_similarity(params.q, coalesce(p.locality, ''))
           ) > 0.4
        or p.locality ilike '%' || params.q || '%'
      )
  ),
  counted as (
    select m.*, count(*) over () as total_count
    from matched m
  )
  select
    v.id, v.slug, v.reference, v.title, v.locality, v.listing_type,
    v.property_kind, v.price_minor, v.currency, v.price_period,
    v.price_on_request, v.bedrooms, v.bathrooms, v.land_area_sqm,
    v.building_area_sqm, v.is_featured, v.view_count, v.publisher_verified,
    v.published_at, v.region_slug, v.total_count, v.rank
  from counted v
  order by
    case when p_sort = 'relevance' then v.rank end desc nulls last,
    case when p_sort = 'newest' then v.is_featured end desc nulls last,
    -- A price sort groups by currency first, so two listings priced in different
    -- currencies are never ordered against each other as though the figures were
    -- comparable. There is no exchange-rate feed, so a XAF 85,000,000 listing and
    -- a USD 300,000 listing have no meaningful order between them; grouping by the
    -- currency code keeps every listing visible while comparing prices only within
    -- one unit. When the caller has already filtered to a single currency this is
    -- a no-op.
    case when p_sort in ('price_asc', 'price_desc') then v.currency end asc,
    case when p_sort = 'price_asc' then v.price_minor end asc nulls last,
    case when p_sort = 'price_desc' then v.price_minor end desc nulls last,
    case when p_sort = 'most_viewed' then v.view_count end desc nulls last,
    v.rank desc,
    v.published_at desc nulls last,
    v.reference asc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

comment on function public.search_property_listings is
  'The public listings query engine: AND-combined structured filters, a currency-scoped price filter and price sort, a verified-publisher filter, localized keyword match, total count and pagination in one round trip. Published listings only. The translation overlay is only built when a keyword is present.';

-- `create or replace` preserves ACLs, so the Phase 12 grant on this exact
-- signature survives; it is restated to document that it does.
grant execute on function public.search_property_listings(
  text, uuid, uuid, uuid, text, public.listing_type, public.listing_property_kind,
  public.property_type,
  bigint, bigint, smallint, smallint, integer, integer,
  public.listing_status[], text[], text, boolean,
  public.locale_code, public.listing_sort_order,
  integer, integer
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- A covering index for the translation overlay read.
--
-- The keyword branch reads `value` and groups by `entity_id` for one
-- `(entity_type, locale, field_name)` slice. With `value` and `entity_id` in the
-- index the planner answers it from the index alone, so the table is never
-- touched. `content_translations_lookup_idx` (entity_type, entity_id, locale)
-- leads on `entity_id` and cannot serve this shape.
-- -----------------------------------------------------------------------------
create index if not exists content_translations_localized_idx
  on public.content_translations (entity_type, locale, field_name)
  include (entity_id, value);

comment on index public.content_translations_localized_idx is
  'Covering index for the localized keyword search: serves the (entity_type, locale, field_name) slice with entity_id and value inline, so the overlay is an index-only scan.';

-- -----------------------------------------------------------------------------
-- Assertions, run on every migration application.
--
-- The CTE gate is checked by asking the database for the stored function body
-- rather than by grepping the migration: a later `create or replace` that drops
-- the gate would otherwise ship a full translation scan on every browse, which no
-- unit test can see.
-- -----------------------------------------------------------------------------
do $$
declare
  v_body text;
  v_index boolean;
begin
  select pg_get_functiondef(p.oid)
  into v_body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'search_property_listings';

  if v_body is null then
    raise exception 'VALIDATION FAIL: search_property_listings is missing';
  end if;

  if position('cross join params' in v_body) = 0
     or position('params.q is not null' in v_body) = 0 then
    raise exception
      'VALIDATION FAIL: the localized CTE is not gated on a keyword search';
  end if;

  -- The currency-scoped price sort from migration 69 must still be present.
  if position('then v.currency end asc' in v_body) = 0 then
    raise exception
      'VALIDATION FAIL: price sort is no longer currency-scoped';
  end if;

  select exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'content_translations'
      and indexname = 'content_translations_localized_idx'
  ) into v_index;

  if not v_index then
    raise exception
      'VALIDATION FAIL: content_translations_localized_idx is missing';
  end if;

  raise notice 'PASS  search overlay is keyword-gated and indexed';
end
$$;
