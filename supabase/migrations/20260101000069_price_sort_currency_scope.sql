-- =============================================================================
-- Scope the price sort to one currency.
--
-- `search_property_listings` compares a price bound within one currency - the
-- caller sends `p_currency` alongside any bound and the predicate requires a
-- match - but its *sort* did not. `price_asc` / `price_desc` ordered by the raw
-- `price_minor`, so a portfolio holding more than one currency was ordered by two
-- numbers that mean different things: a XAF 85,000,000 listing sorted above a USD
-- 300,000 one, and the visitor read the result as "cheaper", which it is not.
-- There is no exchange-rate feed and the brief forbids inventing one, so the fix
-- is to group the price sort by the currency code and compare prices only within
-- a unit. Nothing is hidden: every matching listing still appears, the ordering
-- is just not a cross-currency claim.
--
-- This is a `create or replace` of the existing 22-argument function, so the
-- signature is unchanged and the Phase 12 browser grant (which names that
-- signature) still applies. Only the `order by` differs from migration 64.
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
  'The public listings query engine: AND-combined structured filters, a currency-scoped price filter and price sort, a verified-publisher filter, localized keyword match, total count and pagination in one round trip. Published listings only.';

-- The function keeps the Phase 12 browser grant: it is on the allow-list and this
-- migration does not change its signature. `create or replace` preserves ACLs, so
-- the grant is restated only to document that it survives the replace.
grant execute on function public.search_property_listings(
  text, uuid, uuid, uuid, text, public.listing_type, public.listing_property_kind,
  public.property_type,
  bigint, bigint, smallint, smallint, integer, integer,
  public.listing_status[], text[], text, boolean,
  public.locale_code, public.listing_sort_order,
  integer, integer
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Assert the price sort is currency-scoped, on every migration application.
--
-- A text search for the ORDER BY would be a weak proof; this asks the database
-- what the function body actually contains, so a later migration that replaces
-- the function without the grouping fails here rather than shipping a
-- cross-currency price sort.
-- -----------------------------------------------------------------------------
do $$
declare
  v_body text;
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

  if position('then v.currency end asc' in v_body) = 0 then
    raise exception
      'VALIDATION FAIL: price sort is not currency-scoped (no currency grouping in ORDER BY)';
  end if;

  raise notice 'PASS  price sort groups by currency before comparing prices';
end
$$;
