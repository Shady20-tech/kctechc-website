-- =============================================================================
-- Inquiry pipeline foundation
--
-- One inbox for every public contact route (corporate, department, property,
-- quote). Later phases attach CRM assignment and message threading to this
-- table rather than creating a parallel one per department.
--
-- Design notes:
--   * `status` is a state machine, not free text, so the CRM cannot drift.
--   * `department_id` is nullable: a general corporate inquiry belongs to no
--     department, and forcing one would corrupt reporting.
--   * No PII is duplicated onto other tables; everything hangs off this row.
-- =============================================================================

create type public.inquiry_status as enum (
  'new',
  'assigned',
  'in_progress',
  'responded',
  'closed',
  'spam'
);

create type public.inquiry_source as enum (
  'contact_form',
  'quote_request',
  'property_inquiry',
  'viewing_request',
  'phone',
  'email',
  'walk_in'
);

create table public.inquiries (
  id uuid primary key default extensions.gen_random_uuid(),
  reference text not null unique,
  status public.inquiry_status not null default 'new',
  source public.inquiry_source not null default 'contact_form',
  department_id uuid references public.departments (id) on delete set null,
  locale public.locale_code not null default 'en',

  -- Submitter details. Kept on this row only.
  full_name text not null,
  email extensions.citext not null,
  phone text,
  subject text not null,
  message text not null,

  -- Consent is recorded explicitly because the submitter is asked to agree.
  consent_given boolean not null default false,
  consent_at timestamptz,

  -- Provenance for abuse handling. The IP is stored only as a salted hash, never
  -- in the clear, so the record is useful for rate-limit forensics without
  -- retaining a directly identifying network address.
  ip_hash text,
  user_agent text,

  -- CRM linkage, populated in a later phase.
  assigned_to uuid references auth.users (id) on delete set null,
  responded_at timestamptz,
  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inquiries_reference_format check (
    reference ~ '^KC-[0-9]{8}-[A-Z0-9]{6}$'
  ),
  constraint inquiries_name_length check (char_length(full_name) between 1 and 200),
  constraint inquiries_subject_length check (char_length(subject) between 1 and 200),
  constraint inquiries_message_length check (char_length(message) between 10 and 5000),
  constraint inquiries_email_length check (char_length(email::text) <= 254),
  constraint inquiries_phone_length check (
    phone is null or char_length(phone) <= 40
  ),
  constraint inquiries_consent_consistency check (
    (consent_given and consent_at is not null)
    or (not consent_given and consent_at is null)
  )
);

comment on table public.inquiries is
  'Public inquiry inbox shared by all departments. One row per submission; PII lives here only.';

create index inquiries_status_created_idx
  on public.inquiries (status, created_at desc);

create index inquiries_department_idx
  on public.inquiries (department_id, created_at desc);

create index inquiries_assigned_idx
  on public.inquiries (assigned_to, status)
  where status in ('assigned', 'in_progress');

create trigger inquiries_set_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Append-only event log for an inquiry (status changes, replies, assignments).
-- -----------------------------------------------------------------------------
create table public.inquiry_events (
  id uuid primary key default extensions.gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  from_status public.inquiry_status,
  to_status public.inquiry_status,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inquiry_events_type_format check (event_type ~ '^[a-z][a-z0-9_]*$')
);

comment on table public.inquiry_events is
  'Append-only inquiry timeline. Rows are never updated or deleted.';

create index inquiry_events_inquiry_idx
  on public.inquiry_events (inquiry_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- Submissions are written by the server using the service-role key after Zod
-- validation and rate limiting, so no anonymous insert policy exists: a browser
-- cannot write an inquiry directly, bypassing validation or the honeypot.
-- -----------------------------------------------------------------------------
alter table public.inquiries enable row level security;
alter table public.inquiry_events enable row level security;

create policy "inquiries_select_admin"
  on public.inquiries for select
  to authenticated
  using (public.is_admin());

create policy "inquiries_update_admin"
  on public.inquiries for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "inquiry_events_select_admin"
  on public.inquiry_events for select
  to authenticated
  using (public.is_admin());

create policy "inquiry_events_insert_admin"
  on public.inquiry_events for insert
  to authenticated
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Reference generator: KC-YYYYMMDD-XXXXXX
--
-- Ambiguity-prone characters (I, O, 0, 1) are excluded so a reference can be
-- read aloud or transcribed from a phone call without errors.
-- -----------------------------------------------------------------------------
create or replace function public.generate_inquiry_reference()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  suffix text := '';
  i integer;
begin
  for i in 1..6 loop
    suffix := suffix || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return 'KC-' || to_char(now(), 'YYYYMMDD') || '-' || suffix;
end;
$$;

comment on function public.generate_inquiry_reference() is
  'Human-readable inquiry reference. Excludes I/O/0/1 to avoid transcription errors.';

-- -----------------------------------------------------------------------------
-- French translations for the department names already seeded in migration 3
-- cover the labels; nothing further is required for this phase.
-- -----------------------------------------------------------------------------
