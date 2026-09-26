-- =============================================================================
-- Phase 4 — Digital Marketing store: categories, products, media, slugs,
-- inventory and carts.
--
-- Design notes that shape the whole schema:
--
--   * Canonical (source-locale) text lives on the entity row; localized values
--     live in `content_translations` / `*_slugs`. This is the contract set by
--     migration 3 and followed by services and insights. No parallel translation
--     store is introduced here.
--
--   * Availability is DERIVED from stock, not set independently. A product whose
--     `availability` column could disagree with its `stock` would let the page,
--     the JSON-LD and the Merchant feed tell three different stories. A stored
--     generated column makes that disagreement unrepresentable.
--
--   * `gtin` is nullable and validated. Merchant Center penalises an invented or
--     malformed GTIN harder than an absent one, so an invalid value is rejected
--     rather than stored and hoped over.
--
--   * `price_minor` is an integer in the currency's smallest unit, matching the
--     Stripe-style convention. XAF has no decimal subdivision, so for the store's
--     current currency the value is whole francs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GTIN validity.
--
-- Length and checksum are both checked: a wrong check digit is the most common
-- cause of a Merchant Center GTIN disapproval, and it is a property of the
-- number itself rather than something a later job should clean up.
-- -----------------------------------------------------------------------------
create or replace function public.gtin_is_valid(value text)
returns boolean
language sql
immutable
as $$
  select case
    when value is null then true
    when value !~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$' then false
    else (
      -- Weights alternate 3/1 moving left from the check digit, which is the
      -- GS1 definition for all four GTIN lengths.
      with digits as (
        select
          substring(value, n, 1)::integer as digit,
          (length(value) - n) as position_from_right
        from generate_series(1, length(value) - 1) as n
      ),
      total as (
        select sum(
          digit * (case when position_from_right % 2 = 1 then 3 else 1 end)
        ) as checksum_sum
        from digits
      )
      select ((10 - (checksum_sum % 10)) % 10)
        = substring(value, length(value), 1)::integer
      from total
    )
  end;
$$;

comment on function public.gtin_is_valid(text) is
  'True when the value is a well-formed GTIN (length and GS1 check digit). NULL is valid: an absent GTIN is honest, an invalid one is not.';

-- -----------------------------------------------------------------------------
-- Product categories.
--
-- Flat rather than hierarchical: the public URL is
-- /[locale]/digital-marketing/store/[category]/[slug], which addresses exactly
-- one category level. A parent column would add a second level that no route
-- could reach.
-- -----------------------------------------------------------------------------
create table public.product_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  -- Canonical (source-locale) slug. Localized slugs live in
  -- product_category_slugs so a French URL can differ without changing the
  -- stable identifier the admin and the English URL use.
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  publish_state public.publish_state not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_categories_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint product_categories_name_length check (
    char_length(name) between 1 and 120
  ),
  constraint product_categories_description_length check (
    description is null or char_length(description) between 1 and 1000
  )
);

comment on table public.product_categories is
  'Store categories. Flat because the public URL addresses one category level.';

create index product_categories_public_idx
  on public.product_categories (department_id, sort_order)
  where is_active and publish_state = 'published';

create trigger product_categories_set_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Localized slugs.
--
-- Target locales only: the source locale's slug is the canonical `slug` on the
-- entity row, so storing it here as well would create two values that could
-- drift. `locale <> 'en'` encodes that rule, matching the way
-- `content_translations` never holds source text.
-- -----------------------------------------------------------------------------
create table public.product_category_slugs (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid not null references public.product_categories (id) on delete cascade,
  locale public.locale_code not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_category_slugs_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint product_category_slugs_target_only check (locale <> 'en'),
  constraint product_category_slugs_unique unique (locale, slug),
  constraint product_category_slugs_one_per_locale unique (category_id, locale)
);

comment on table public.product_category_slugs is
  'Localized category slugs for target locales. The source locale uses product_categories.slug.';

create trigger product_category_slugs_set_updated_at
  before update on public.product_category_slugs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Products.
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid not null references public.product_categories (id) on delete restrict,
  -- Canonical (source-locale) slug; localized slugs live in product_slugs.
  slug text not null unique,
  sku text not null unique,

  -- Optional identifying attributes. `brand` is absent when the brief does not
  -- name one, and `gtin` when the manufacturer does not publish one; both are
  -- better empty than guessed.
  brand text,
  gtin text,

  title text not null,
  short_description text not null,
  description text not null,
  -- [{ label, value }] pairs describing the item itself. Localizable so a French
  -- page does not show English specification labels.
  specifications jsonb not null default '[]'::jsonb,

  price_minor integer not null,
  currency text not null default 'XAF',

  -- The physical count. Negative stock is unrepresentable, and the generated
  -- `availability` below is the only thing that reads it for display, so the UI,
  -- structured data and feed cannot disagree about availability.
  stock integer not null default 0,
  -- Set only to force a state stock cannot express (preorder, backorder,
  -- discontinued). Left null, availability follows stock.
  availability_override public.product_availability,
  availability public.product_availability
    generated always as (
      coalesce(
        availability_override,
        case
          when stock > 0 then 'in_stock'::public.product_availability
          else 'out_of_stock'::public.product_availability
        end
      )
    ) stored,
  condition public.product_condition not null default 'new',

  publish_state public.publish_state not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint products_sku_format check (sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$'),
  constraint products_title_length check (char_length(title) between 1 and 200),
  constraint products_short_description_length check (
    char_length(short_description) between 1 and 400
  ),
  constraint products_description_length check (
    char_length(description) between 1 and 20000
  ),
  constraint products_specifications_is_array check (
    jsonb_typeof(specifications) = 'array'
  ),
  constraint products_price_non_negative check (price_minor >= 0),
  constraint products_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint products_stock_non_negative check (stock >= 0),
  constraint products_brand_length check (
    brand is null or char_length(brand) between 1 and 120
  ),
  -- An absent GTIN is allowed; a malformed one is not.
  constraint products_gtin_valid check (public.gtin_is_valid(gtin)),
  constraint products_published_requires_at check (
    (publish_state = 'published' and published_at is not null)
    or publish_state <> 'published'
  )
);

comment on table public.products is
  'Store products. Availability is derived from stock so it cannot contradict it.';
comment on column public.products.price_minor is
  'Price in the currency''s smallest unit. XAF has no subdivision, so this is whole francs.';
comment on column public.products.gtin is
  'Only set when the manufacturer genuinely publishes one. Validated for length and check digit.';
comment on column public.products.availability is
  'Derived from stock and availability_override. Never set directly.';

create index products_public_idx
  on public.products (category_id, title)
  where publish_state = 'published';

create index products_published_at_idx
  on public.products (published_at desc)
  where publish_state = 'published';

-- Trigram index for the store's text search, which matches on title and SKU.
create index products_title_trgm_idx
  on public.products using gin (title extensions.gin_trgm_ops);

create index products_brand_idx on public.products (brand) where brand is not null;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_slugs (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  locale public.locale_code not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_slugs_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint product_slugs_target_only check (locale <> 'en'),
  constraint product_slugs_unique unique (locale, slug),
  constraint product_slugs_one_per_locale unique (product_id, locale)
);

comment on table public.product_slugs is
  'Localized product slugs for target locales. The source locale uses products.slug.';

create trigger product_slugs_set_updated_at
  before update on public.product_slugs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Product media (Supabase Storage objects).
--
-- `alt_text` is NOT NULL: an image without a description is inaccessible, and
-- making it optional would let one through by omission. Alt text is localizable
-- via content_translations under the 'product_media' entity type.
-- -----------------------------------------------------------------------------
create table public.product_media (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  width integer,
  height integer,
  position integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Storage-relative object path: no scheme, no leading slash, no traversal.
  constraint product_media_path_format check (
    storage_path ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$'
    and storage_path !~ '\.\.'
    and storage_path !~ '^/'
  ),
  constraint product_media_alt_length check (
    char_length(alt_text) between 1 and 300
  ),
  constraint product_media_dimensions_positive check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint product_media_unique_path unique (product_id, storage_path)
);

comment on table public.product_media is
  'Product images stored in Supabase Storage. Alt text is required and localizable.';

create index product_media_product_idx
  on public.product_media (product_id, position);

-- At most one primary image per product, so "the" product image is well defined
-- for the OG image, the feed and the JSON-LD.
create unique index product_media_one_primary_idx
  on public.product_media (product_id)
  where is_primary;

create trigger product_media_set_updated_at
  before update on public.product_media
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Inventory ledger.
--
-- Stock is changed only by appending a movement. The trigger applies the delta
-- to `products.stock` under a row lock and records the resulting level, so the
-- ledger and the denormalised stock cannot drift and concurrent adjustments
-- cannot interleave into a negative count.
-- -----------------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  delta integer not null,
  reason public.inventory_reason not null,
  note text,
  stock_after integer not null,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint inventory_movements_delta_non_zero check (delta <> 0),
  constraint inventory_movements_stock_after_non_negative check (stock_after >= 0),
  constraint inventory_movements_note_length check (
    note is null or char_length(note) between 1 and 500
  )
);

comment on table public.inventory_movements is
  'Append-only stock ledger. products.stock is maintained from this table by trigger.';

create index inventory_movements_product_idx
  on public.inventory_movements (product_id, created_at desc);

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
as $$
declare
  new_stock integer;
begin
  -- Lock the product row so two concurrent adjustments cannot both read the same
  -- starting level and write a wrong result.
  select stock into new_stock
  from public.products
  where id = new.product_id
  for update;

  if not found then
    raise exception 'Product % does not exist', new.product_id
      using errcode = 'foreign_key_violation';
  end if;

  new_stock := new_stock + new.delta;

  if new_stock < 0 then
    raise exception
      'Inventory adjustment of % would take product % to a negative stock level',
      new.delta, new.product_id
      using errcode = 'check_violation';
  end if;

  new.stock_after := new_stock;

  update public.products
  set stock = new_stock
  where id = new.product_id;

  return new;
end;
$$;

create trigger inventory_movements_apply
  before insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- -----------------------------------------------------------------------------
-- Publishing requires an image.
--
-- Merchant Center rejects a product without an image, and a product page with no
-- visual is not usable. Enforced here rather than in the admin form so no other
-- write path can publish an unillustrated product. Because media is attached
-- after the row exists, a product is created as a draft and published once its
-- image is uploaded — which is the correct order of operations anyway.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_published_product_has_media()
returns trigger
language plpgsql
as $$
begin
  if new.publish_state = 'published'
     and not exists (
       select 1 from public.product_media m where m.product_id = new.id
     ) then
    raise exception
      'Product % cannot be published without at least one image', new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger products_publish_requires_media
  before insert or update of publish_state on public.products
  for each row execute function public.enforce_published_product_has_media();

-- -----------------------------------------------------------------------------
-- Carts.
--
-- Persisted server-side and addressed by an opaque token held in an httpOnly
-- cookie, so a cart survives across devices' sessions without exposing a
-- guessable id. There is deliberately no anonymous RLS policy: like the inquiry
-- pipeline, all access goes through a server action holding the service-role
-- client, so a browser cannot enumerate other carts.
-- -----------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default extensions.gen_random_uuid(),
  token text not null unique,
  status public.cart_status not null default 'active',
  locale public.locale_code not null default 'en',
  currency text not null default 'XAF',
  customer_id uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint carts_token_length check (char_length(token) between 32 and 128),
  constraint carts_currency_format check (currency ~ '^[A-Z]{3}$')
);

comment on table public.carts is
  'Persistent carts addressed by an opaque token. Accessed only through server actions.';

create index carts_active_idx on public.carts (token) where status = 'active';
create index carts_customer_idx
  on public.carts (customer_id) where customer_id is not null;

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default extensions.gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null,
  -- Price captured when the item was added, so a later price change does not
  -- silently rewrite what the customer was shown.
  unit_price_minor integer not null,
  currency text not null default 'XAF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cart_items_quantity_positive check (quantity > 0 and quantity <= 999),
  constraint cart_items_price_non_negative check (unit_price_minor >= 0),
  constraint cart_items_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint cart_items_unique_product unique (cart_id, product_id)
);

comment on table public.cart_items is
  'Cart lines. unit_price_minor snapshots the price at add time.';

create index cart_items_cart_idx on public.cart_items (cart_id);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security.
--
-- The public boundary: only published, active products in published, active
-- categories are readable anonymously. Draft catalogue content is invisible to
-- the anon role because the policy — not a filter in application code — says so.
-- -----------------------------------------------------------------------------
alter table public.product_categories enable row level security;
alter table public.product_category_slugs enable row level security;
alter table public.products enable row level security;
alter table public.product_slugs enable row level security;
alter table public.product_media enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

create policy "product_categories_select_published"
  on public.product_categories for select
  to anon, authenticated
  using (is_active and publish_state = 'published');

create policy "product_categories_write_admin"
  on public.product_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_category_slugs_select_public"
  on public.product_category_slugs for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.product_categories c
      where c.id = category_id
        and c.is_active
        and c.publish_state = 'published'
    )
  );

create policy "product_category_slugs_write_admin"
  on public.product_category_slugs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A published product in an unpublished category stays private: the category is
-- part of the URL, so publishing the product alone would produce a page whose
-- breadcrumb target 404s.
create policy "products_select_published"
  on public.products for select
  to anon, authenticated
  using (
    publish_state = 'published'
    and exists (
      select 1 from public.product_categories c
      where c.id = category_id
        and c.is_active
        and c.publish_state = 'published'
    )
  );

create policy "products_write_admin"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_slugs_select_public"
  on public.product_slugs for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      join public.product_categories c on c.id = p.category_id
      where p.id = product_id
        and p.publish_state = 'published'
        and c.is_active
        and c.publish_state = 'published'
    )
  );

create policy "product_slugs_write_admin"
  on public.product_slugs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_media_select_public"
  on public.product_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.publish_state = 'published'
    )
  );

create policy "product_media_write_admin"
  on public.product_media for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The ledger is an internal record; it is not part of the public catalogue.
create policy "inventory_movements_select_admin"
  on public.inventory_movements for select
  to authenticated
  using (public.is_admin());

create policy "inventory_movements_write_admin"
  on public.inventory_movements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Carts have no anonymous policy by design. Only the service-role client, behind
-- a server action that validates the opaque token, may read or write them.
create policy "carts_select_admin"
  on public.carts for select
  to authenticated
  using (public.is_admin());

create policy "carts_write_admin"
  on public.carts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "cart_items_select_admin"
  on public.cart_items for select
  to authenticated
  using (public.is_admin());

create policy "cart_items_write_admin"
  on public.cart_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
