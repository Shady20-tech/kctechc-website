-- =============================================================================
-- Departments, localized content, translation index, sync jobs, site settings
-- =============================================================================

create table public.departments (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  accent_color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint departments_name_length check (char_length(name) between 1 and 120),
  constraint departments_accent_color_format check (
    accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

comment on table public.departments is
  'The three corporate departments. Slugs are stable across locales for SEO.';

create index departments_active_sort_idx
  on public.departments (sort_order) where is_active;

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Generic localized content store.
--
-- Canonical text lives on the entity row; localized text lives here so the site
-- renders even when Tolgee is unavailable. `source_updated_at` records when the
-- source field last changed, which is how a translation becomes `outdated`
-- without being deleted.
-- -----------------------------------------------------------------------------
create table public.content_translations (
  id uuid primary key default extensions.gen_random_uuid(),
  entity_type public.translatable_entity_type not null,
  entity_id uuid not null,
  field_name text not null,
  locale public.locale_code not null,
  value text not null,
  state public.translation_state not null default 'pending',
  source_locale public.locale_code not null default 'en',
  source_updated_at timestamptz,
  translated_at timestamptz,
  translated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_translations_field_format check (
    field_name ~ '^[a-z][a-z0-9_]*$'
  ),
  constraint content_translations_unique
    unique (entity_type, entity_id, field_name, locale)
);

comment on table public.content_translations is
  'Localized field values for dynamic content. Never holds canonical source text.';

create index content_translations_lookup_idx
  on public.content_translations (entity_type, entity_id, locale);

create index content_translations_state_idx
  on public.content_translations (state)
  where state in ('pending', 'in_progress', 'outdated');

create trigger content_translations_set_updated_at
  before update on public.content_translations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Translation index — one row per translatable field per target locale.
-- Consumed by the Tolgee sync job and populated by the publishing workflow,
-- never by hand.
-- -----------------------------------------------------------------------------
create table public.translation_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  translation_key text not null unique,
  entity_type public.translatable_entity_type not null,
  entity_id uuid not null,
  field_name text not null,
  source_locale public.locale_code not null default 'en',
  target_locales public.locale_code[] not null,
  state public.translation_state not null default 'pending',
  sync_state public.sync_state not null default 'queued',
  tolgee_key_id text,
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint translation_entries_key_format check (
    translation_key ~ '^[a-z_]+\.[0-9a-f-]{36}\.[a-z0-9_]+\.[a-z]{2}$'
  ),
  constraint translation_entries_targets_not_empty check (
    array_length(target_locales, 1) >= 1
  ),
  constraint translation_entries_field_format check (
    field_name ~ '^[a-z][a-z0-9_]*$'
  )
);

comment on table public.translation_entries is
  'Translation index consumed by the Tolgee synchronisation job. Keys are deterministic and sync is idempotent.';

create index translation_entries_sync_idx
  on public.translation_entries (sync_state, updated_at)
  where sync_state in ('queued', 'failed');

create index translation_entries_entity_idx
  on public.translation_entries (entity_type, entity_id);

create trigger translation_entries_set_updated_at
  before update on public.translation_entries
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Durable sync job queue: retryable and idempotent. `attempts` bounds the
-- retry loop; `started_at` marks a claim.
-- -----------------------------------------------------------------------------
create table public.translation_sync_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  translation_entry_id uuid references public.translation_entries (id) on delete cascade,
  job_type text not null default 'tolgee_push',
  status public.sync_state not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint translation_sync_jobs_attempts_bounds check (
    attempts >= 0 and attempts <= max_attempts
  ),
  constraint translation_sync_jobs_type_format check (
    job_type ~ '^[a-z][a-z0-9_]*$'
  )
);

comment on table public.translation_sync_jobs is
  'Asynchronous, retryable Tolgee synchronisation queue.';

create index translation_sync_jobs_pending_idx
  on public.translation_sync_jobs (scheduled_at) where status = 'queued';

create trigger translation_sync_jobs_set_updated_at
  before update on public.translation_sync_jobs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Site settings — editable content, never hardcoded business facts.
-- -----------------------------------------------------------------------------
create table public.site_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_settings_key_format check (key ~ '^[a-z][a-z0-9_.]*$')
);

comment on table public.site_settings is
  'Editable site configuration. Public rows may be read anonymously; the rest are admin-only.';

create index site_settings_public_idx on public.site_settings (key) where is_public;

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.departments enable row level security;
alter table public.content_translations enable row level security;
alter table public.translation_entries enable row level security;
alter table public.translation_sync_jobs enable row level security;
alter table public.site_settings enable row level security;

create policy "departments_select_public"
  on public.departments for select
  to anon, authenticated
  using (is_active);

create policy "departments_write_super_admin"
  on public.departments for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Only completed translations are publicly readable; drafts stay internal.
create policy "content_translations_select_published"
  on public.content_translations for select
  to anon, authenticated
  using (state in ('translated', 'reviewed'));

create policy "content_translations_select_admin"
  on public.content_translations for select
  to authenticated
  using (public.is_admin());

create policy "content_translations_write_admin"
  on public.content_translations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "translation_entries_admin_all"
  on public.translation_entries for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "translation_sync_jobs_admin_all"
  on public.translation_sync_jobs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "site_settings_select_public"
  on public.site_settings for select
  to anon, authenticated
  using (is_public);

create policy "site_settings_select_admin"
  on public.site_settings for select
  to authenticated
  using (public.is_admin());

create policy "site_settings_write_admin"
  on public.site_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
