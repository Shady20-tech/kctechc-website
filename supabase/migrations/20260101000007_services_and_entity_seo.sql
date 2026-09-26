-- =============================================================================
-- Phase 3 — Digital Marketing services and per-entity localized SEO
--
-- Design notes:
--   * Canonical (English) text lives on `services`, matching the contract set by
--     migration 3: localized values live in `content_translations`, canonical
--     values never do. No parallel translation table is created here.
--   * `publish_state` defaults to 'draft'. New content is never public by
--     accident; an editor must publish it deliberately.
--   * `entity_seo` is separate from the row it describes because SEO fields are
--     per locale, and burying them on the entity row would make a locale's title
--     and description impossible to constrain independently.
-- =============================================================================

create table public.services (
  id uuid primary key default extensions.gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  slug text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  publish_state public.publish_state not null default 'draft',

  -- Canonical (source-locale) content. Localized values live in
  -- content_translations; the renderer falls back to these when a translation is
  -- absent so a page never shows an empty string for real content.
  title text not null,
  summary text not null,
  description text not null,
  -- Short capability bullets. Describes the discipline, not KC-specific claims.
  features jsonb not null default '[]'::jsonb,
  -- [{ question, answer }] pairs. Emitted as FAQPage structured data only when
  -- non-empty, so no FAQ markup is invented for a service that has none.
  faqs jsonb not null default '[]'::jsonb,
  -- Local operating context (how work is scoped and delivered in Cameroon).
  delivery_notes text,

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint services_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint services_title_length check (char_length(title) between 1 and 160),
  constraint services_summary_length check (char_length(summary) between 1 and 320),
  constraint services_description_length check (
    char_length(description) between 1 and 20000
  ),
  constraint services_features_is_array check (jsonb_typeof(features) = 'array'),
  constraint services_faqs_is_array check (jsonb_typeof(faqs) = 'array'),
  -- A published row must carry the timestamp the sitemap and Article markup read.
  constraint services_published_requires_at check (
    (publish_state = 'published' and published_at is not null)
    or publish_state <> 'published'
  )
);

comment on table public.services is
  'Canonical service records. Slugs are stable across locales and unique within a department.';
comment on column public.services.features is
  'Capability bullets describing the discipline. No client counts, prices or certifications.';

-- Slug only needs to be unique within its department because the public URL is
-- /[locale]/[department]/services/[slug].
create unique index services_department_slug_idx
  on public.services (department_id, slug);

create index services_public_idx
  on public.services (department_id, sort_order)
  where is_active and publish_state = 'published';

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Per-entity, per-locale SEO overrides.
--
-- Deliberately not a column set on `services`: SEO fields are locale-specific and
-- must be able to differ between en and fr without one locale's row being able to
-- overwrite the other's.
-- -----------------------------------------------------------------------------
create table public.entity_seo (
  id uuid primary key default extensions.gen_random_uuid(),
  entity_type public.translatable_entity_type not null,
  entity_id uuid not null,
  locale public.locale_code not null,

  title text,
  description text,
  canonical_override text,
  og_image_path text,
  noindex boolean not null default false,
  structured_data jsonb,

  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint entity_seo_unique unique (entity_type, entity_id, locale),
  constraint entity_seo_title_length check (
    title is null or char_length(title) between 1 and 200
  ),
  constraint entity_seo_description_length check (
    description is null or char_length(description) between 1 and 400
  )
);

comment on table public.entity_seo is
  'Per-locale SEO overrides for dynamic content. Absent rows mean "use the generated default".';

create index entity_seo_entity_idx on public.entity_seo (entity_type, entity_id);

create trigger entity_seo_set_updated_at
  before update on public.entity_seo
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- Draft services are not readable anonymously. This is the boundary that keeps
-- unfinished content out of the index; hiding it in the UI would not be.
-- -----------------------------------------------------------------------------
alter table public.services enable row level security;
alter table public.entity_seo enable row level security;

create policy "services_select_published"
  on public.services for select
  to anon, authenticated
  using (is_active and publish_state = 'published');

create policy "services_select_admin"
  on public.services for select
  to authenticated
  using (public.is_admin());

create policy "services_write_admin"
  on public.services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "entity_seo_select_public"
  on public.entity_seo for select
  to anon, authenticated
  using (true);

create policy "entity_seo_write_admin"
  on public.entity_seo for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
