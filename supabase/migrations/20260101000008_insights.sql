-- =============================================================================
-- Phase 3 — Insights (articles), categories and authors
--
-- Design notes:
--   * `insights` is the article entity. Localized title/summary/body live in
--     `content_translations` under entity_type 'insight'; canonical text is here.
--   * `categories` is a first-class table rather than a free-text column, so
--     category pages and filters cannot fragment on spelling.
--   * Authors are proper nouns and are therefore NOT translated. `role_title`
--     and `bio` are canonical text; if KC supplies French-language authors the
--     `translatable_entity_type` enum gains an 'author' member in a later
--     migration. Extending an enum and using the new value in the same
--     transaction is not permitted, so that change is deliberately not bundled
--     here.
--   * "Indexable only when complete and published" is enforced by a database
--     constraint, not by a code path that could be bypassed.
-- =============================================================================

create table public.insight_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint insight_categories_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint insight_categories_name_length check (char_length(name) between 1 and 80)
);

comment on table public.insight_categories is
  'Article categories. A table rather than free text so filtering cannot fragment on spelling.';

create index insight_categories_active_idx
  on public.insight_categories (sort_order) where is_active;

create trigger insight_categories_set_updated_at
  before update on public.insight_categories
  for each row execute function public.set_updated_at();

create table public.authors (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  -- A person's name is a proper noun: it is the same in every locale and is
  -- intentionally excluded from the translation tables.
  display_name text not null,
  role_title text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint authors_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint authors_display_name_length check (
    char_length(display_name) between 1 and 120
  )
);

comment on table public.authors is
  'Article authors. Names are proper nouns and are not localized.';

create trigger authors_set_updated_at
  before update on public.authors
  for each row execute function public.set_updated_at();

create table public.insights (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  -- Optional links: an article may be corporate-wide, or belong to a department
  -- and/or a category. Nullable because forcing one would misattribute content.
  department_id uuid references public.departments (id) on delete set null,
  category_id uuid references public.insight_categories (id) on delete set null,
  author_id uuid references public.authors (id) on delete set null,

  publish_state public.publish_state not null default 'draft',
  is_featured boolean not null default false,

  -- Canonical (source-locale) content.
  title text not null,
  summary text not null,
  -- Constrained Markdown subset, rendered through an escaping renderer. Raw HTML
  -- in this field is escaped, never executed.
  body text not null,
  cover_image_path text,
  -- Optional internal links surfaced as "related content".
  related_service_slugs text[] not null default '{}',

  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint insights_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint insights_title_length check (char_length(title) between 1 and 160),
  constraint insights_summary_length check (char_length(summary) between 1 and 320),
  constraint insights_body_length check (char_length(body) between 1 and 60000),

  -- The completeness gate. An article can only be published once it has an
  -- author and a publication date, so an anonymous or undated article can never
  -- reach the index. This is what makes "indexable only when complete" a
  -- property of the data rather than of one code path.
  constraint insights_published_requires_author_and_date check (
    publish_state <> 'published'
    or (author_id is not null and published_at is not null)
  )
);

comment on table public.insights is
  'Articles. Published rows must carry an author and a date, so incomplete content cannot be indexed.';

create index insights_public_idx
  on public.insights (published_at desc)
  where publish_state = 'published';

create index insights_category_idx
  on public.insights (category_id, published_at desc)
  where publish_state = 'published';

create index insights_department_idx
  on public.insights (department_id, published_at desc)
  where publish_state = 'published';

create trigger insights_set_updated_at
  before update on public.insights
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.insight_categories enable row level security;
alter table public.authors enable row level security;
alter table public.insights enable row level security;

create policy "insight_categories_select_public"
  on public.insight_categories for select
  to anon, authenticated
  using (is_active);

create policy "insight_categories_write_admin"
  on public.insight_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authors_select_public"
  on public.authors for select
  to anon, authenticated
  using (is_active);

create policy "authors_write_admin"
  on public.authors for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Drafts and archived articles are invisible to anonymous readers. Archived
-- content stays in the table so existing links and references survive.
create policy "insights_select_published"
  on public.insights for select
  to anon, authenticated
  using (publish_state = 'published');

create policy "insights_select_admin"
  on public.insights for select
  to authenticated
  using (public.is_admin());

create policy "insights_write_admin"
  on public.insights for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
