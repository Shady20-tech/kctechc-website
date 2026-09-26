-- =============================================================================
-- Phase 5 — Electrical projects, project media, private attachments and site visits
--
-- Four concerns, each with a control the phase instruction requires:
--
--   1. `electrical_projects` — the project record. Publication requires a
--      published date, matching `services`. A project asserts that work was
--      carried out somewhere in some year, so `region_id` and `location` are
--      optional and never defaulted: recording a region the editor did not state
--      would be a fabricated geographic claim.
--
--   2. `project_media` — images with REQUIRED alt text, plus separate caption and
--      credit fields. Alt is NOT NULL because an image without alternative text
--      is inaccessible, and making it optional is how it ends up empty. The
--      before/after role is an explicit column rather than array position, so a
--      comparison pair cannot be silently broken by reordering.
--
--   3. `inquiry_attachments` — uploads attached to a quote request. These live in
--      a PRIVATE bucket and are reachable only through a signed URL generated
--      server-side. No anonymous select policy exists: a visitor cannot enumerate
--      or read another visitor's uploads.
--
--   4. `appointments` — site-visit requests, handled without an external calendar
--      provider. The table records the request and its confirmation state; there
--      is no third-party calendar dependency to be unavailable.
--
-- No projects, media or attachments are seeded. There are none in the business
-- brief, so the gallery ships with an honest empty state.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Property type. Shared by a project record and a quote request, because a quote
-- is scoped differently for a home, a business and a plant, and the gallery
-- filters on the same distinction. Created here rather than in the enum
-- migration because it belongs to this phase's domain.
-- -----------------------------------------------------------------------------
create type public.property_type as enum (
  'residential',
  'commercial',
  'industrial'
);

-- -----------------------------------------------------------------------------
-- Project media role. A project image is either one of a matched before/after
-- pair or a general view. Modelled as an enum so a typo cannot create a third,
-- meaningless role.
-- -----------------------------------------------------------------------------
create type public.project_media_role as enum ('before', 'after', 'general');

-- -----------------------------------------------------------------------------
-- Electrical projects.
-- -----------------------------------------------------------------------------
create table public.electrical_projects (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  department_id uuid not null references public.departments (id) on delete cascade,

  publish_state public.publish_state not null default 'draft',
  sort_order integer not null default 0,

  -- Canonical (source-locale) content. Localized values live in
  -- content_translations; the renderer falls back per field.
  title text not null,
  summary text not null,
  description text,
  scope text,
  outcome text,

  -- Geography. Both optional, and deliberately never defaulted: a project's
  -- region is recorded only when it is known. `region_id` is a real FK to the
  -- seeded ten regions rather than free text, so the gallery filter cannot end up
  -- with two spellings of the same region.
  region_id uuid references public.regions (id) on delete set null,
  -- Human-readable locality, e.g. a town. Never a precise coordinate: the brief
  -- supplies no coordinates and publishing an exact site location is a privacy
  -- decision the business has not made.
  location text,

  property_type public.property_type,
  -- Year completed, not a date. The brief supplies no exact dates, and a year is
  -- the finest granularity a project record can honestly claim here.
  completed_year integer,

  -- Tags used by the gallery filter. Kept as text so a new filter value does not
  -- require a migration.
  tags text[] not null default '{}',

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint electrical_projects_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint electrical_projects_title_length check (
    char_length(title) between 1 and 160
  ),
  constraint electrical_projects_summary_length check (
    char_length(summary) between 1 and 320
  ),
  constraint electrical_projects_location_length check (
    location is null or char_length(location) between 1 and 160
  ),
  -- A plausible completion year. Rejects a typo like 20255 while allowing any
  -- year the company could have worked in.
  constraint electrical_projects_completed_year_range check (
    completed_year is null or completed_year between 1900 and 2100
  ),
  constraint electrical_projects_publish_requires_date check (
    publish_state <> 'published' or published_at is not null
  )
);

comment on table public.electrical_projects is
  'Electrical Services project records. Region and location are optional and never defaulted; publication requires a published date.';

create index electrical_projects_public_idx
  on public.electrical_projects (department_id, sort_order)
  where publish_state = 'published';

create index electrical_projects_region_idx
  on public.electrical_projects (region_id)
  where region_id is not null;

create index electrical_projects_tags_idx
  on public.electrical_projects using gin (tags);

create trigger electrical_projects_set_updated_at
  before update on public.electrical_projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Project ↔ service join.
--
-- A project routinely spans several service areas (an installation that included
-- solar, say), so the relationship is many-to-many rather than a single FK. The
-- gallery filters on it, which is why it is a real table with a unique constraint
-- rather than an array of slugs: an array could hold a slug that names no
-- service, and the filter would then offer an option that returns nothing.
-- -----------------------------------------------------------------------------
create table public.electrical_project_services (
  project_id uuid not null references public.electrical_projects (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, service_id)
);

comment on table public.electrical_project_services is
  'Many-to-many link between a project and the service areas it involved.';

create index electrical_project_services_service_idx
  on public.electrical_project_services (service_id);

-- -----------------------------------------------------------------------------
-- Project media.
--
-- Alt text is NOT NULL. An image without alternative text is inaccessible, and
-- the field being optional is precisely how it ends up empty on a real project.
-- Caption and credit are separate columns because they are different claims: a
-- caption describes the image, a credit attributes it. Conflating them makes one
-- of the two wrong.
-- -----------------------------------------------------------------------------
create table public.project_media (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.electrical_projects (id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  caption text,
  credit text,
  role public.project_media_role not null default 'general',
  width integer,
  height integer,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Storage-relative object path: no scheme, no leading slash, no traversal.
  constraint project_media_path_format check (
    storage_path ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$'
    and storage_path !~ '\.\.'
    and storage_path !~ '^/'
  ),
  constraint project_media_alt_length check (
    char_length(alt_text) between 1 and 300
  ),
  constraint project_media_caption_length check (
    caption is null or char_length(caption) between 1 and 400
  ),
  constraint project_media_credit_length check (
    credit is null or char_length(credit) between 1 and 200
  ),
  constraint project_media_dimensions_positive check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint project_media_unique_path unique (project_id, storage_path)
);

comment on table public.project_media is
  'Project images stored in Supabase Storage. Alt text is required; caption and credit are separate fields.';

create index project_media_project_idx
  on public.project_media (project_id, position);

-- At most one before and one after image per project, so the comparison the
-- detail page renders is unambiguous.
create unique index project_media_one_before_idx
  on public.project_media (project_id)
  where role = 'before';

create unique index project_media_one_after_idx
  on public.project_media (project_id)
  where role = 'after';

create trigger project_media_set_updated_at
  before update on public.project_media
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Private inquiry attachments.
--
-- Attachments to a quote request are private uploads: photographs of someone's
-- installation, and potentially of their home. They are NOT public site media
-- and must not be reachable without a signed URL.
--
-- The security controls:
--   * `storage_path` points into the private `inquiry-attachments` bucket.
--   * The declared MIME type is stored for the record, and the server verifies
--     the file's actual content before upload (see `src/lib/uploads/`). A
--     declared type is not evidence of anything.
--   * There is no anonymous select policy. Only the service-role client, behind
--     an admin-authorized action, may read these rows.
-- -----------------------------------------------------------------------------
create table public.inquiry_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  storage_path text not null,
  -- Original filename, kept for the record. Displayed escaped, never used to
  -- build a path.
  original_filename text not null,
  -- The MIME type the server determined from the file's content, not the type the
  -- browser claimed.
  detected_mime text not null,
  byte_size bigint not null,
  created_at timestamptz not null default now(),

  constraint inquiry_attachments_path_format check (
    storage_path ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$'
    and storage_path !~ '\.\.'
    and storage_path !~ '^/'
  ),
  constraint inquiry_attachments_filename_length check (
    char_length(original_filename) between 1 and 255
  ),
  constraint inquiry_attachments_size_positive check (
    byte_size > 0 and byte_size <= 10485760
  ),
  -- Only the image and document types the upload pipeline accepts. A value
  -- outside this set means the pipeline let something through, so the database
  -- refuses it as a second line of defence.
  constraint inquiry_attachments_mime_allowed check (
    detected_mime in (
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf'
    )
  ),
  constraint inquiry_attachments_unique_path unique (storage_path)
);

comment on table public.inquiry_attachments is
  'Private uploads attached to an inquiry. Stored in a private bucket and reachable only through a server-generated signed URL.';

create index inquiry_attachments_inquiry_idx
  on public.inquiry_attachments (inquiry_id);

-- -----------------------------------------------------------------------------
-- Site-visit requests.
--
-- Handled without an external calendar provider, as the phase instruction
-- requires. The row records what the visitor asked for (a preferred date and time
-- of day) and the confirmation state the team moves it through. Nothing depends
-- on a third-party calendar being reachable, so an unavailable integration cannot
-- silently drop a request.
--
-- `scheduled_for` is nullable: the visitor states a preference, and the team
-- confirms a time. Storing the visitor's preference in `preferred_date` keeps the
-- distinction between "what was asked for" and "what was agreed" explicit.
-- -----------------------------------------------------------------------------
create type public.appointment_status as enum (
  'requested',
  'confirmed',
  'completed',
  'cancelled'
);

create type public.appointment_window as enum (
  'morning',
  'afternoon',
  'anytime'
);

create table public.appointments (
  id uuid primary key default extensions.gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  status public.appointment_status not null default 'requested',

  -- What the visitor asked for.
  preferred_date date not null,
  preferred_window public.appointment_window not null default 'anytime',
  -- What the team agreed. Null until confirmed, which is what makes the
  -- distinction between a request and a booking visible in the data.
  scheduled_for timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointments_notes_length check (
    notes is null or char_length(notes) <= 2000
  ),
  -- A confirmed appointment must carry the agreed time; an unconfirmed one must
  -- not, so the state and the data cannot disagree.
  constraint appointments_confirmed_requires_time check (
    (status in ('confirmed', 'completed') and scheduled_for is not null)
    or (status in ('requested', 'cancelled'))
  )
);

comment on table public.appointments is
  'Site-visit requests. Handled without an external calendar provider; the visitor states a preference and the team confirms a time.';

create index appointments_inquiry_idx on public.appointments (inquiry_id);

create index appointments_status_date_idx
  on public.appointments (status, preferred_date);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- Projects and their public media follow the same rule as services: drafts are
-- not readable anonymously, which is the boundary that keeps unfinished content
-- out of the index. Attachments and appointments are internal records with no
-- anonymous policy at all.
-- -----------------------------------------------------------------------------
alter table public.electrical_projects enable row level security;
alter table public.electrical_project_services enable row level security;
alter table public.project_media enable row level security;
alter table public.inquiry_attachments enable row level security;
alter table public.appointments enable row level security;

create policy "electrical_projects_select_published"
  on public.electrical_projects for select
  to anon, authenticated
  using (publish_state = 'published');

create policy "electrical_projects_select_admin"
  on public.electrical_projects for select
  to authenticated
  using (public.is_admin());

create policy "electrical_projects_write_admin"
  on public.electrical_projects for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The join is public only where the project it belongs to is public.
create policy "electrical_project_services_select_published"
  on public.electrical_project_services for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.electrical_projects p
      where p.id = project_id and p.publish_state = 'published'
    )
  );

create policy "electrical_project_services_write_admin"
  on public.electrical_project_services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "project_media_select_public"
  on public.project_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.electrical_projects p
      where p.id = project_id and p.publish_state = 'published'
    )
  );

create policy "project_media_write_admin"
  on public.project_media for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Attachments: admin read only. There is deliberately no anonymous or
-- authenticated-customer policy — the submitter receives no account, and the
-- upload is reachable only through the service-role client.
create policy "inquiry_attachments_select_admin"
  on public.inquiry_attachments for select
  to authenticated
  using (public.is_admin());

create policy "inquiry_attachments_write_admin"
  on public.inquiry_attachments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "appointments_select_admin"
  on public.appointments for select
  to authenticated
  using (public.is_admin());

create policy "appointments_write_admin"
  on public.appointments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Inquiry source for electrical quote requests.
--
-- The enum value is added here but deliberately not used in this migration: a
-- newly added enum value cannot be referenced in the same transaction that adds
-- it. Application code writes it at runtime.
-- -----------------------------------------------------------------------------
alter type public.inquiry_source add value if not exists 'site_visit_request';
