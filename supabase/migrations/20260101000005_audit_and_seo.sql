-- =============================================================================
-- Audit logging and SEO primitives (metadata overrides, redirects)
-- =============================================================================

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_format check (action ~ '^[a-z][a-z0-9_]*$'),
  constraint audit_logs_entity_type_format check (
    entity_type ~ '^[a-z][a-z0-9_]*$'
  )
);

comment on table public.audit_logs is
  'Append-only trail for privileged operations. Rows are never updated or deleted.';

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

-- -----------------------------------------------------------------------------
-- Per-route SEO overrides. Absent rows mean "use the generated default".
-- -----------------------------------------------------------------------------
create table public.seo_metadata (
  id uuid primary key default extensions.gen_random_uuid(),
  path text not null,
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
  constraint seo_metadata_unique_path_locale unique (path, locale),
  constraint seo_metadata_path_format check (path ~ '^/'),
  constraint seo_metadata_title_length check (
    title is null or char_length(title) between 1 and 200
  ),
  constraint seo_metadata_description_length check (
    description is null or char_length(description) between 1 and 400
  )
);

create index seo_metadata_path_idx on public.seo_metadata (path);

create trigger seo_metadata_set_updated_at
  before update on public.seo_metadata
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Redirect management. Targets must be site-relative, so the table cannot be
-- used as an open redirector.
-- -----------------------------------------------------------------------------
create table public.redirects (
  id uuid primary key default extensions.gen_random_uuid(),
  source_path text not null unique,
  target_path text not null,
  status_code integer not null default 301,
  is_active boolean not null default true,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint redirects_source_format check (
    source_path ~ '^/' and source_path !~ '^//'
  ),
  constraint redirects_target_format check (
    target_path ~ '^/' and target_path !~ '^//' and target_path <> source_path
  ),
  constraint redirects_status_code_allowed check (status_code in (301, 302, 307, 308))
);

create index redirects_active_idx on public.redirects (source_path) where is_active;

create trigger redirects_set_updated_at
  before update on public.redirects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;
alter table public.seo_metadata enable row level security;
alter table public.redirects enable row level security;

-- The trail is readable by admins only; no policy grants update or delete.
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

create policy "seo_metadata_select_public"
  on public.seo_metadata for select
  to anon, authenticated
  using (true);

create policy "seo_metadata_write_admin"
  on public.seo_metadata for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "redirects_select_active"
  on public.redirects for select
  to anon, authenticated
  using (is_active);

create policy "redirects_write_admin"
  on public.redirects for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
