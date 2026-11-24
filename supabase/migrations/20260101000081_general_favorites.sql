-- =============================================================================
-- General customer favourites: products and articles.
--
-- The marketplace already has `listing_favorites` (migration 28). The customer
-- account hub and the store/article surfaces need the same save-for-later
-- gesture outside Real Estate, so this migration adds two tables rather than
-- replacing the listing table:
--
--   * a separate table keeps a real foreign key and `on delete cascade` for each
--     entity, which a single polymorphic `(entity_type, entity_id)` table cannot
--     express;
--   * the existing listing rows and policies stay untouched, so nothing already
--     saved is migrated or lost;
--   * every table carries the same own-only policy shape, so the database is the
--     boundary and the Server Action cannot read or write another account's row.
--
-- No update policy: a favourite has no mutable field. Changing what it points at
-- is a different favourite, expressed as a delete and an insert.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Saved products.
-- -----------------------------------------------------------------------------
create table public.product_favorites (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_favorites_unique unique (user_id, product_id)
);

comment on table public.product_favorites is
  'A registered customer''s saved store products. One row per (user, product).';

-- The favourites page reads one user's saved products newest first.
create index product_favorites_user_idx
  on public.product_favorites (user_id, created_at desc);

-- The "is this product saved?" lookup runs per card on the store grid.
create index product_favorites_product_idx
  on public.product_favorites (product_id);

alter table public.product_favorites enable row level security;

create policy "product_favorites_select_own"
  on public.product_favorites for select
  to authenticated
  using (auth.uid() = user_id);

create policy "product_favorites_insert_own"
  on public.product_favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "product_favorites_delete_own"
  on public.product_favorites for delete
  to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Saved articles.
-- -----------------------------------------------------------------------------
create table public.insight_favorites (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_id uuid not null references public.insights (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint insight_favorites_unique unique (user_id, insight_id)
);

comment on table public.insight_favorites is
  'A registered customer''s saved insight articles. One row per (user, insight).';

create index insight_favorites_user_idx
  on public.insight_favorites (user_id, created_at desc);

create index insight_favorites_insight_idx
  on public.insight_favorites (insight_id);

alter table public.insight_favorites enable row level security;

create policy "insight_favorites_select_own"
  on public.insight_favorites for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insight_favorites_insert_own"
  on public.insight_favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "insight_favorites_delete_own"
  on public.insight_favorites for delete
  to authenticated
  using (auth.uid() = user_id);

-- The three tables are deliberately independent. A favourite of an article that
-- is later unpublished stays in the table (the article row still exists), and the
-- public read path filters by publish state, so the saved item simply stops
-- appearing until it is published again. Deleting the entity cascades the rows.
