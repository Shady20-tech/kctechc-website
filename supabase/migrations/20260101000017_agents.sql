-- =============================================================================
-- Phase 6 — Agent records.
--
-- An agent is a person who works listings, and the phase requires that an agent
-- sees only their own listings' data "unless their role explicitly allows broader
-- access". That requirement needs a row to point at: authorization is decided by
-- comparing the listing's agent to the caller's agent record, so the record has
-- to exist and be resolvable from a user id.
--
-- Kept separate from `profiles` rather than adding columns to it. A profile is
-- an account; an agent record is a business identity with a licence number, a
-- service area and contact details that are shown publicly. A customer who is
-- never an agent has no agent record, and an agent whose account is deactivated
-- still has a business history worth retaining.
-- =============================================================================

create table public.agent_profiles (
  id uuid primary key default extensions.gen_random_uuid(),

  -- The account this agent signs in with. Nullable so an agent can be recorded
  -- before they are given an account, and set to null rather than deleted if the
  -- account is removed — the listings must keep their agent.
  user_id uuid unique references auth.users (id) on delete set null,

  -- Public identity.
  display_name text not null,
  slug text not null unique,
  title text,
  bio text,
  -- Shown on listings. Public by design: this is the contact route the business
  -- publishes, as opposed to `listing_private_details.owner_phone`, which is the
  -- owner's private number.
  public_email extensions.citext,
  public_phone text,
  photo_path text,

  -- Business identity.
  license_number text,
  -- Where the agent works. A real FK so an agent's area cannot be a spelling of
  -- a region that does not exist.
  region_id uuid references public.regions (id) on delete set null,
  -- Stable slugs for the areas the agent covers, matching the amenity approach:
  -- text so a new area needs no migration, an array so it is not a delimited
  -- string.
  service_areas text[] not null default '{}',

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agent_profiles_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint agent_profiles_display_name_length check (
    char_length(display_name) between 2 and 120
  ),
  constraint agent_profiles_title_length check (
    title is null or char_length(title) between 1 and 120
  ),
  constraint agent_profiles_bio_length check (
    bio is null or char_length(bio) between 1 and 4000
  ),
  constraint agent_profiles_public_email_length check (
    public_email is null or char_length(public_email::text) <= 254
  ),
  constraint agent_profiles_public_phone_length check (
    public_phone is null or char_length(public_phone) between 5 and 40
  ),
  constraint agent_profiles_license_length check (
    license_number is null or char_length(license_number) between 1 and 64
  )
);

comment on table public.agent_profiles is
  'Real estate agent business identity. Separate from profiles: an account is not a business identity, and listings must survive an account removal.';
comment on column public.agent_profiles.public_email is
  'Published contact address. Distinct from the owner''s private contact in listing_private_details.';

create index agent_profiles_active_idx
  on public.agent_profiles (display_name)
  where is_active;

create index agent_profiles_region_idx
  on public.agent_profiles (region_id)
  where region_id is not null;

create index agent_profiles_service_areas_idx
  on public.agent_profiles using gin (service_areas);

create trigger agent_profiles_set_updated_at
  before update on public.agent_profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Resolve the current caller's agent record.
--
-- SECURITY DEFINER for the same reason `current_user_role()` is: a policy on
-- `property_listings` needs to compare against `agent_profiles`, and reading it
-- through a policy-protected path would recurse. `search_path` is pinned so the
-- function cannot be hijacked.
--
-- Returns null when the caller has no agent record, which is the correct answer
-- for an admin who is not also an agent: it makes `agent_id = current_agent_id()`
-- false rather than accidentally true.
-- -----------------------------------------------------------------------------
create or replace function public.current_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id
  from public.agent_profiles a
  where a.user_id = auth.uid()
  limit 1;
$$;

comment on function public.current_agent_id is
  'The agent record belonging to the current caller, or null. Used to scope an agent''s access to their own listings.';

-- -----------------------------------------------------------------------------
-- Does the caller administer real estate?
--
-- Deliberately NOT `is_admin()`. That helper is true for `real_estate_agent`,
-- because an agent is an admin of the site in the sense of reaching the internal
-- surface. Using it here would make every agent a manager of every listing and
-- every other agent's inquiries, which is precisely the access the phase
-- forbids. This helper is the narrower question: may this caller act across the
-- whole real estate department?
-- -----------------------------------------------------------------------------
create or replace function public.is_real_estate_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.current_user_role() in (
      'real_estate_admin',
      'department_staff',
      'super_admin'
    ),
    false
  );
$$;

comment on function public.is_real_estate_admin is
  'True for roles that may act across all real estate listings. Excludes real_estate_agent, which is scoped to its own listings.';

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.agent_profiles enable row level security;

-- Agent business identity is public: it is the contact information the business
-- publishes on a listing.
create policy "agent_profiles_select_public"
  on public.agent_profiles for select
  to anon, authenticated
  using (is_active);

create policy "agent_profiles_select_admin"
  on public.agent_profiles for select
  to authenticated
  using (public.is_real_estate_admin());

-- An agent may maintain their own record, but not create one: creating an agent
-- is what grants listing access, so it stays an administrative act.
create policy "agent_profiles_update_own"
  on public.agent_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "agent_profiles_write_admin"
  on public.agent_profiles for all
  to authenticated
  using (public.is_real_estate_admin())
  with check (public.is_real_estate_admin());
