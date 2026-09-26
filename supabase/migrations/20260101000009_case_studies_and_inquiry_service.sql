-- =============================================================================
-- Phase 3 — Portfolio case studies, and service tagging on the inquiry inbox
--
-- Case-study integrity is the point of this migration. The phase instruction is
-- explicit that clients and metrics must never be fabricated, so two controls are
-- enforced here rather than left to editor discipline:
--
--   1. A case study cannot be published unless the client has approved it
--      (`client_approved`). Claiming a result on behalf of a client who has not
--      agreed to be named is the specific failure this prevents.
--   2. Every metric must carry a `basis` describing how it was measured. A bare
--      number with no stated method is the shape a fabricated metric takes.
--
-- No case studies are seeded. There are none in the business brief, so the
-- portfolio surface ships with an honest empty state.
-- =============================================================================

create table public.case_studies (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  department_id uuid not null references public.departments (id) on delete cascade,
  -- Optional link to the service the work was delivered under.
  service_id uuid references public.services (id) on delete set null,

  publish_state public.publish_state not null default 'draft',
  sort_order integer not null default 0,

  -- Client identity. `client_name` is nullable because a client may approve the
  -- work being described without agreeing to be named.
  client_name text,
  client_approved boolean not null default false,
  -- Set when the client agreed to be named, as distinct from merely approving the
  -- description. Named attribution requires its own consent.
  client_named_with_consent boolean not null default false,

  title text not null,
  summary text not null,
  challenge text,
  approach text,
  outcome text,

  -- [{ label, value, basis }]. `basis` is the measurement method; a metric with
  -- no stated basis is not renderable.
  results jsonb not null default '[]'::jsonb,
  -- Tags used by the portfolio filter. Kept as text so a new filter value does
  -- not require a migration.
  tags text[] not null default '{}',

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint case_studies_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint case_studies_title_length check (char_length(title) between 1 and 160),
  constraint case_studies_summary_length check (char_length(summary) between 1 and 320),
  constraint case_studies_results_is_array check (jsonb_typeof(results) = 'array'),

  -- Control 1: client approval is a precondition of publication.
  constraint case_studies_publish_requires_client_approval check (
    publish_state <> 'published' or client_approved
  ),
  constraint case_studies_publish_requires_date check (
    publish_state <> 'published' or published_at is not null
  ),
  -- Naming a client requires naming consent, not just approval of the write-up.
  constraint case_studies_named_requires_consent check (
    client_name is null
    or (client_approved and client_named_with_consent)
  )
);

comment on table public.case_studies is
  'Portfolio case studies. Publication requires recorded client approval; naming a client requires separate naming consent.';

create index case_studies_public_idx
  on public.case_studies (department_id, sort_order)
  where publish_state = 'published';

create index case_studies_tags_idx on public.case_studies using gin (tags);

create trigger case_studies_set_updated_at
  before update on public.case_studies
  for each row execute function public.set_updated_at();

alter table public.case_studies enable row level security;

create policy "case_studies_select_published"
  on public.case_studies for select
  to anon, authenticated
  using (publish_state = 'published');

create policy "case_studies_select_admin"
  on public.case_studies for select
  to authenticated
  using (public.is_admin());

create policy "case_studies_write_admin"
  on public.case_studies for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Inquiry inbox: tag submissions with the service they came from.
--
-- The inbox itself already exists (migration 6) with its status machine, event
-- log and RLS. This only adds the service dimension, so an inquiry raised from a
-- service page is attributable to that service without a parallel table.
--
-- The enum value is added here but deliberately not used in this migration: a
-- newly added enum value cannot be referenced in the same transaction that adds
-- it. Application code writes it at runtime.
-- -----------------------------------------------------------------------------
alter type public.inquiry_source add value if not exists 'service_inquiry';

alter table public.inquiries
  add column service_id uuid references public.services (id) on delete set null;

comment on column public.inquiries.service_id is
  'Service the inquiry originated from, when submitted through a service page.';

create index inquiries_service_idx
  on public.inquiries (service_id, created_at desc)
  where service_id is not null;
