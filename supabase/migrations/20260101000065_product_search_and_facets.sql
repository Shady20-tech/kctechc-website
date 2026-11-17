-- -----------------------------------------------------------------------------
-- Reusable marketplace filtering, phase 6, part 1: database-side product search.
--
-- The store catalogue used to be loaded in full and filtered in application code
-- (`src/lib/store/search.ts`). That is correct for a small catalogue but it is not
-- the contract the brief asks for: filtering and pagination must move to the
-- database, counts must be accurate, and an unlimited catalogue must never be
-- loaded into memory.
--
-- This migration adds:
--
--   1. `products.search_vector`, a stored generated column over the canonical
--      English text, with a GIN index. The localized text is matched separately
--      inside `search_products` (see below).
--   2. `search_products(...)`, the catalogue query engine: AND-combined structured
--      filters, a currency-scoped price filter, availability, an in-stock flag, a
--      localized keyword match, the total count and pagination in one round trip.
--   3. `product_facets(...)`, real per-category and per-brand counts under the same
--      visibility predicate the search uses.
--
-- Why the localized match lives in the function rather than in the vector:
-- `content_translations` holds the French text, and a stored generated column
-- cannot read another table. The vector therefore covers the canonical columns and
-- the function adds an ILIKE against the locale's translations, so a French
-- visitor searching "ordinateur" still finds a product whose English title says
-- "laptop" — the behaviour the application-code search had, preserved.
--
-- A new SECURITY DEFINER function gets Supabase's default EXECUTE grant to
-- `anon`/`authenticated`, and the Phase 12 hardening migration ran long before
-- this one, so the revoke-and-regrant is repeated here for every function created
-- below. `search_products` and `product_facets` are deliberately browser-callable
-- (the storefront calls them with the anonymous key) and are added to the
-- hardening allow-list in the same change.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 1. A generated search vector over the canonical product text.
--
-- The English columns are the source locale, so a French search that matches only
-- the translation is handled by the function's ILIKE branch. Weighted so a title
-- hit outranks a description hit in relevance ordering.
-- -----------------------------------------------------------------------------
alter table public.products
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(sku, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

comment on column public.products.search_vector is
  'Generated full-text vector over the canonical (English) product text. Localized text is matched in search_products against content_translations.';

create index products_search_vector_idx
  on public.products using gin (search_vector);

-- The storefront filters availability and sorts by price within a currency, so a
-- partial index over the published rows serves both the filter and the ordering.
create index products_store_browse_idx
  on public.products (currency, price_minor)
  where publish_state = 'published';

-- -----------------------------------------------------------------------------
-- 2. The catalogue query engine.
--
-- Mirrors `search_property_listings`: the public visibility set is pinned
-- internally (published, in an active published category), so a caller may narrow
-- within it but cannot widen it, and the total count comes from a window function
-- over the same predicate, so the number shown and the rows returned cannot
-- disagree.
-- -----------------------------------------------------------------------------
create or replace function public.search_products(
  p_query text default null,
  p_department_id uuid default null,
  p_category_id uuid default null,
  -- A category's localized slug, resolved to an id before the call; the storefront
  -- URL carries the locale's own slug.
  p_currency text default null,
  p_min_price integer default null,
  p_max_price integer default null,
  -- Restrict to products that are actually orderable.
  p_in_stock boolean default null,
  p_availability public.product_availability default null,
  p_condition public.product_condition default null,
  p_brand text default null,
  p_locale public.locale_code default 'en',
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  category_id uuid,
  department_id uuid,
  slug text,
  sku text,
  brand text,
  title text,
  short_description text,
  price_minor integer,
  currency text,
  stock integer,
  availability public.product_availability,
  condition public.product_condition,
  published_at timestamptz,
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
      t.entity_type = 'product'
      and t.locale = p_locale
      and t.field_name in ('name', 'short_description', 'description')
      and t.state in ('translated', 'reviewed')
    group by t.entity_id
  ),
  matched as (
    select
      p.id,
      p.category_id,
      c.department_id,
      p.slug,
      p.sku,
      p.brand,
      p.title,
      p.short_description,
      p.price_minor,
      p.currency,
      p.stock,
      p.availability,
      p.condition,
      p.published_at,
      (
        case
          when params.tsq is not null and p.search_vector @@ params.tsq
            then 1.0 + ts_rank(p.search_vector, params.tsq)
          when params.q is not null and loc.value ilike '%' || params.q || '%'
            then 1.0
          when params.q is not null
            and extensions.word_similarity(params.q, p.title) > 0.4
            then extensions.word_similarity(params.q, p.title)
          else 0.0
        end
      )::real as rank
    from public.products p
    join public.product_categories c on c.id = p.category_id
    left join localized loc on loc.entity_id = p.id
    cross join params
    where
      -- The public visibility set, pinned here rather than trusted from the
      -- caller: a published product in a published, active category.
      p.publish_state = 'published'
      and c.publish_state = 'published'
      and c.is_active
      and (p_department_id is null or c.department_id = p_department_id)
      and (p_category_id is null or p.category_id = p_category_id)
      -- Price is compared within one currency. The currency predicate is applied
      -- whenever a currency is given, which the application always does alongside
      -- a price bound, so the two numbers compared are the same unit.
      and (p_currency is null or p.currency = p_currency)
      and (p_min_price is null or p.price_minor >= p_min_price)
      and (p_max_price is null or p.price_minor <= p_max_price)
      and (not coalesce(p_in_stock, false) or p.stock > 0)
      and (p_availability is null or p.availability = p_availability)
      and (p_condition is null or p.condition = p_condition)
      and (
        nullif(btrim(coalesce(p_brand, '')), '') is null
        or p.brand ilike '%' || btrim(p_brand) || '%'
      )
      and (
        params.q is null
        or p.search_vector @@ params.tsq
        or p.sku ilike '%' || params.q || '%'
        or loc.value ilike '%' || params.q || '%'
        or extensions.word_similarity(params.q, p.title) > 0.4
      )
  ),
  counted as (
    select m.*, count(*) over () as total_count
    from matched m
  )
  select
    v.id, v.category_id, v.department_id, v.slug, v.sku, v.brand, v.title,
    v.short_description, v.price_minor, v.currency, v.stock, v.availability,
    v.condition, v.published_at, v.total_count, v.rank
  from counted v
  order by
    case when p_sort = 'relevance' then v.rank end desc nulls last,
    case when p_sort = 'price_asc' then v.price_minor end asc nulls last,
    case when p_sort = 'price_desc' then v.price_minor end desc nulls last,
    case when p_sort = 'name_asc' then v.title end asc nulls last,
    case when p_sort = 'newest' then v.published_at end desc nulls last,
    v.rank desc,
    v.title asc,
    v.id asc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

comment on function public.search_products is
  'The storefront catalogue query engine: AND-combined structured filters, a currency-scoped price filter, availability, a localized keyword match, total count and pagination in one round trip. Published products in published, active categories only.';

-- -----------------------------------------------------------------------------
-- 3. Facet counts for the store navigation.
--
-- One row per facet value under the SAME visibility predicate the search uses, so
-- a category shortcut reading "12" leads to a result set of 12 and a brand with no
-- products is never offered.
-- -----------------------------------------------------------------------------
create or replace function public.product_facets(p_department_id uuid default null)
returns table (facet text, value text, total bigint)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with visible as (
    select p.category_id, p.brand, c.department_id
    from public.products p
    join public.product_categories c on c.id = p.category_id
    where
      p.publish_state = 'published'
      and c.publish_state = 'published'
      and c.is_active
      and (p_department_id is null or c.department_id = p_department_id)
  )
  select 'category', v.category_id::text, count(*)::bigint
  from visible v
  group by v.category_id
  union all
  select 'brand', v.brand, count(*)::bigint
  from visible v
  where v.brand is not null
  group by v.brand;
$$;

comment on function public.product_facets is
  'Real per-category and per-brand product counts under the same predicate search_products uses, so a storefront shortcut cannot lead to an empty result set.';

-- -----------------------------------------------------------------------------
-- 4. EXECUTE classification.
--
-- Supabase grants EXECUTE to anon/authenticated on every new public function. The
-- storefront calls these two with the anonymous key, so they keep that grant and
-- are added to the Phase 12 allow-list; the revoke-then-regrant below makes the
-- classification explicit in this migration too, so a future re-run of the
-- hardening migration cannot silently change it.
-- -----------------------------------------------------------------------------
revoke all on function public.search_products(
  text, uuid, uuid, text, integer, integer, boolean,
  public.product_availability, public.product_condition, text,
  public.locale_code, text, integer, integer
) from public;

revoke all on function public.product_facets(uuid) from public;

grant execute on function public.search_products(
  text, uuid, uuid, text, integer, integer, boolean,
  public.product_availability, public.product_condition, text,
  public.locale_code, text, integer, integer
) to anon, authenticated;

grant execute on function public.product_facets(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Assertion: the catalogue query never leaks an unpublished product.
--
-- A SECURITY DEFINER function bypasses RLS, so "published only" must be proven by
-- the function itself. This runs on every migration application and on a fresh
-- database, and is the database-free complement to `store-catalogue.test.ts`.
-- -----------------------------------------------------------------------------
do $$
declare
  v_department_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  v_hidden_id uuid;
  v_visible bigint;
  v_total bigint;
begin
  select d.id into v_department_id from public.departments d limit 1;
  if v_department_id is null then
    raise exception 'VALIDATION FAIL: no department exists to build the fixture';
  end if;

  insert into public.product_categories (
    department_id, slug, name, description, sort_order, is_active, publish_state
  )
  values (
    v_department_id, 'zz-search-probe', 'Search probe', 'Probe category', 9999, true, 'published'
  )
  returning id into v_category_id;

  -- A published product with media (the publish trigger requires media first).
  insert into public.products (
    category_id, slug, sku, title, short_description, description,
    price_minor, currency, stock, publish_state
  )
  values (
    v_category_id, 'zz-search-probe-visible', 'ZZ-PROBE-VISIBLE',
    'Probe visible laptop', 'A probe product', 'Probe description body',
    100000, 'XAF', 4, 'draft'
  )
  returning id into v_product_id;

  insert into public.product_media (product_id, storage_path, alt_text, is_primary)
  values (v_product_id, 'zz/probe-visible.jpg', 'Probe visible image', true);

  update public.products set publish_state = 'published', published_at = now()
  where id = v_product_id;

  -- A draft product in the same category: invisible to the storefront.
  insert into public.products (
    category_id, slug, sku, title, short_description, description,
    price_minor, currency, stock, publish_state
  )
  values (
    v_category_id, 'zz-search-probe-hidden', 'ZZ-PROBE-HIDDEN',
    'Probe hidden laptop', 'A probe product', 'Probe description body',
    100000, 'XAF', 4, 'draft'
  )
  returning id into v_hidden_id;

  select count(*) into v_visible
  from public.search_products(
    p_query => 'probe', p_category_id => v_category_id,
    p_limit => 50, p_offset => 0
  );
  if v_visible <> 1 then
    raise exception 'VALIDATION FAIL: search_products returned % probe rows, expected 1 (draft must be hidden)', v_visible;
  end if;

  select f.total into v_total
  from public.product_facets(v_department_id) f
  where f.facet = 'category' and f.value = v_category_id::text;
  if v_total is null or v_total <> 1 then
    raise exception 'VALIDATION FAIL: product_facets counted % published probe rows, expected 1', coalesce(v_total, -1);
  end if;

  -- A price bound in a currency the product is not priced in must exclude it.
  select count(*) into v_visible
  from public.search_products(
    p_category_id => v_category_id, p_currency => 'USD',
    p_min_price => 1, p_limit => 50, p_offset => 0
  );
  if v_visible <> 0 then
    raise exception 'VALIDATION FAIL: a USD price filter matched an XAF product';
  end if;

  -- Clean up the fixture, including its translation rows, which have no FK to
  -- products and would otherwise strand queued Tolgee work.
  delete from public.translation_entries
  where entity_type = 'product' and entity_id in (v_product_id, v_hidden_id);
  delete from public.content_translations
  where entity_type = 'product' and entity_id in (v_product_id, v_hidden_id);
  delete from public.products where id in (v_product_id, v_hidden_id);
  delete from public.product_categories where id = v_category_id;
end $$;
