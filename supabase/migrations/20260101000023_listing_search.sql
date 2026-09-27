-- =============================================================================
-- Phase 6 — Listing search.
--
-- Requirement: "Add full-text/trigram search capability where useful, without
-- prematurely introducing Elasticsearch."
--
-- The indexes from migration 18 make both mechanisms fast, but neither is
-- reachable from the API as it stands, and the reason is worth stating because it
-- is not obvious:
--
--   * `pg_trgm` is installed in the `extensions` schema, so its operators are
--     `extensions.%` and its function is `extensions.similarity()`. PostgREST can
--     only express operators in `public`, so a client cannot write a trigram
--     comparison at all.
--   * `ILIKE '%term%'` DOES use the trigram index (verified with EXPLAIN) and is
--     reachable through `.ilike()`. But it is substring matching, not fuzzy: it
--     will not match "vila" against "villa", because the typo is not a substring.
--
-- So typo tolerance has to be exposed as a function. That is what this migration
-- provides: a `public` function PostgREST can call over RPC, which combines
-- ranked full-text search with a trigram fallback for when the text does not
-- match exactly. No separate search service is needed for this corpus, which is
-- what the requirement asks for.
-- =============================================================================

create or replace function public.search_property_listings(
  p_query text default null,
  p_region_id uuid default null,
  p_listing_type public.listing_type default null,
  p_property_kind public.listing_property_kind default null,
  p_min_price bigint default null,
  p_max_price bigint default null,
  p_min_bedrooms smallint default null,
  p_amenities text[] default null,
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
  published_at timestamptz,
  region_slug text,
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
  )
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
    p.published_at,
    r.slug as region_slug,
    (
      case
        -- A full-text hit ranks above a fuzzy one: it means the words were
        -- actually present rather than merely similar.
        when params.tsq is not null and p.search_vector @@ params.tsq
          then 1.0 + ts_rank(p.search_vector, params.tsq)
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
  cross join params
  where
    -- Only published listings are searchable. Drafts and owner submissions that
    -- have not been approved are not merely filtered from the UI; they are
    -- excluded here, so the search endpoint cannot be used to discover them.
    p.status = 'published'
    and (p_region_id is null or p.region_id = p_region_id)
    and (p_listing_type is null or p.listing_type = p_listing_type)
    and (p_property_kind is null or p.property_kind = p_property_kind)
    and (p_min_price is null or p.price_minor >= p_min_price)
    and (p_max_price is null or p.price_minor <= p_max_price)
    and (p_min_bedrooms is null or p.bedrooms >= p_min_bedrooms)
    -- The requested amenities must be a SUBSET of the listing's, which is what a
    -- filter means to a buyer: a listing must have every feature asked for. The
    -- parameter is on the left; writing `p.amenities <@ p.amenities` would compare
    -- the column to itself and always be true.
    and (p_amenities is null or p_amenities <@ p.amenities)
    and (
      params.q is null
      or p.search_vector @@ params.tsq
      -- Typo tolerance, on the same measure as the ranking above.
      or greatest(
           extensions.word_similarity(params.q, p.title),
           extensions.word_similarity(params.q, coalesce(p.locality, ''))
         ) > 0.4
      -- Exact substring on the locality, so "limbe" finds Limbe listings even
      -- when the word appears in neither the title nor the description.
      or p.locality ilike '%' || params.q || '%'
    )
  order by
    p.is_featured desc,
    rank desc,
    p.published_at desc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

comment on function public.search_property_listings is
  'Ranked listing search: full-text first, trigram fallback for typos. Published listings only. Exposed over RPC because pg_trgm operators live in the extensions schema and PostgREST cannot express them.';

-- The function is SECURITY DEFINER and reads only published rows, but it must not
-- become a way to read a draft. The status predicate above is the control; the
-- grant below is what makes it callable.
grant execute on function public.search_property_listings(
  text, uuid, public.listing_type, public.listing_property_kind,
  bigint, bigint, smallint, text[], integer, integer
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Fuzzy-match a region or division name.
--
-- The CSV importer and the admin filter both need "which region did the user
-- mean", where the input may be misspelled. Same schema-qualification reason as
-- above: this has to be a function to be callable.
-- -----------------------------------------------------------------------------
create or replace function public.match_region_by_name(p_name text)
returns table (id uuid, code text, slug text, name text, similarity real)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select
    r.id, r.code, r.slug, r.name,
    greatest(
      extensions.similarity(r.name, p_name),
      coalesce(extensions.similarity(r.name_fr, p_name), 0),
      extensions.similarity(r.code, p_name)
    )::real as similarity
  from public.regions r
  where
    -- A threshold rather than a top-1 pick: a caller must be able to tell that
    -- nothing matched well, instead of silently receiving the least-bad region.
    greatest(
      extensions.similarity(r.name, p_name),
      coalesce(extensions.similarity(r.name_fr, p_name), 0),
      extensions.similarity(r.code, p_name)
    ) > 0.3
  order by similarity desc;
$$;

comment on function public.match_region_by_name is
  'Fuzzy region lookup for import and filtering. Returns every match above a similarity threshold so a caller can detect an ambiguous or absent match.';

grant execute on function public.match_region_by_name(text) to anon, authenticated;
