-- =============================================================================
-- Phase 1.1 — Profile residency and completion.
--
-- The `profiles` table already carried the account's identity: full name, email,
-- role, locale, phone, avatar and active flag. What it did not carry was where
-- the person actually is, which the marketplace side of the site needs: a
-- landlord states a region so their listing's geography can be defaulted, and an
-- agent's service area is only meaningful against a country.
--
-- Three decisions are worth stating, because each one is a place this could have
-- been modelled wrongly:
--
--   1. The existing `phone` column is REUSED, not duplicated. The brief asks for
--      "phone number" among the new fields, but a second column would be two
--      sources of truth for one fact, and the first thing to go wrong would be a
--      row whose two phone columns disagree. `phone` already has a length check
--      that admits an international number; this migration adds a *format* check
--      that admits one too, and nothing else.
--
--   2. `country_of_residence` is stored as a name AND an ISO code. The name is
--      what a person reads back ("Cameroon"); the code is what a query groups and
--      filters on, because a country's name is not stable across languages and a
--      string compare on "Côte d'Ivoire" and "Cote d Ivoire" is two countries.
--      Cameroon is the default on both, which is the brief's requirement and also
--      the honest default for a company whose own address is in Limbe.
--
--   3. `permanent_residency` is a boolean, which the brief explicitly permits
--      ("a clear boolean or properly modelled residency status"). It answers one
--      question — is this person a permanent resident of the country they stated,
--      as opposed to a temporary resident or a non-resident — and a boolean is the
--      smallest thing that answers it. It is deliberately NOT a status enum: the
--      finer distinction has no consumer yet, and inventing a taxonomy before
--      there is a use for it is how a column ends up with a value nobody can
--      interpret.
--
-- The `profiles` table is small and every row is an account, so these columns are
-- added in place rather than in a side table. The capability model that *does*
-- need its own table is in the next migration, and the reason is different: a
-- person has many memberships over time, and each one has its own review history.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Residency columns.
-- -----------------------------------------------------------------------------
alter table public.profiles
  -- Where the person lives. Free text rather than an FK: the site's geography
  -- tables describe Cameroon only, and a customer may live anywhere.
  add column country_of_residence text not null default 'Cameroon',
  -- ISO 3166-1 alpha-2. Optional, as the brief allows, but defaulted so a row
  -- written before this migration reads as Cameroon rather than as unknown.
  add column country_iso_code text default 'CM',
  -- The city, town or quarter. Free text for the same reason as the country: the
  -- subdivision table is Cameroon-only and not every customer lives in Cameroon.
  add column city text,
  -- The Cameroon region, where applicable. An FK so a region that does not exist
  -- cannot be recorded, matching how a listing records its region.
  add column region_id uuid references public.regions (id) on delete set null,
  -- Permanent resident of `country_of_residence`? Defaulted to true because the
  -- overwhelming majority of accounts are resident where they say they are, and a
  -- null would be a third state nobody asked for.
  add column permanent_residency boolean not null default true,
  -- When the profile first became complete. Null means incomplete; see the trigger
  -- below for what "complete" means and why it is derived rather than stored.
  add column profile_completed_at timestamptz;

comment on column public.profiles.country_of_residence is
  'The country the person lives in, as a display name. Free text: the geography tables describe Cameroon only.';
comment on column public.profiles.country_iso_code is
  'ISO 3166-1 alpha-2 code for country_of_residence. Optional, defaulted to CM. The stable key to group and filter on.';
comment on column public.profiles.city is
  'City, town or quarter of residence. Free text for the same reason as the country.';
comment on column public.profiles.region_id is
  'Cameroon region of residence, where applicable. Null for a resident of another country — enforced by profiles_region_requires_cameroon.';
comment on column public.profiles.permanent_residency is
  'True when the person is a permanent resident of country_of_residence, rather than a temporary resident or a non-resident.';
comment on column public.profiles.profile_completed_at is
  'When the profile last became complete (name, phone, country and city all present). Derived by sync_profile_completion(); null means incomplete.';

-- -----------------------------------------------------------------------------
-- Constraints.
--
-- Each is written to be a statement about the data rather than about the form
-- that happens to collect it, so a migration, an import or a psql session is
-- held to the same rule as the application.
-- -----------------------------------------------------------------------------

-- The region is a Cameroon concept, so it may only be set for a resident of
-- Cameroon. `coalesce` rather than `= 'CM'` alone, because a null country code
-- would make the comparison null, and a CHECK that evaluates to null is
-- *satisfied* — which is exactly the hole this closes.
alter table public.profiles
  add constraint profiles_region_requires_cameroon check (
    region_id is null or coalesce(country_iso_code, '') = 'CM'
  );

alter table public.profiles
  add constraint profiles_country_name_length check (
    char_length(btrim(country_of_residence)) between 2 and 80
  );

alter table public.profiles
  add constraint profiles_country_iso_format check (
    country_iso_code is null or country_iso_code ~ '^[A-Z]{2}$'
  );

alter table public.profiles
  add constraint profiles_city_length check (
    city is null or char_length(btrim(city)) between 1 and 120
  );

-- International phone format.
--
-- The existing `profiles_phone_length` check (5–32 characters) already admits an
-- international number; what it does not do is refuse a value that is not a phone
-- number at all. This narrows it to the characters a phone number is written with
-- — an optional leading `+`, digits, and the separators people actually type
-- (space, hyphen, dot, slash, parentheses) — in any order, so both `+237 679 202
-- 265` and `(+237) 679-202-265` pass.
--
-- Added NOT VALID on purpose. A live table may already hold a value this would
-- refuse (a number written with a trailing extension, say), and a plain ADD
-- CONSTRAINT would abort the migration on that one row — turning a formatting
-- nicety into an outage. NOT VALID enforces the rule on every new and updated row
-- while leaving existing rows untouched, which is the correct trade for a
-- constraint that is a quality improvement rather than a safety control. Run
-- `alter table public.profiles validate constraint profiles_phone_format;` once
-- the existing rows are known to conform.
alter table public.profiles
  add constraint profiles_phone_format check (
    phone is null or phone ~ '^[0-9+ ()./-]{5,32}$'
  ) not valid;

-- -----------------------------------------------------------------------------
-- Profile completion.
--
-- Completion is DERIVED, not stored as a boolean the application maintains. A
-- stored flag is a second copy of a fact the columns already hold, and the first
-- thing to go wrong is a row that says "complete" while a required field is
-- empty — which is exactly the row an operator would trust.
--
-- So the trigger recomputes the answer from the columns on every write, and
-- `profile_completed_at` is the only stored part: a timestamp that is set when
-- the profile becomes complete and cleared when it stops being complete. Null
-- therefore means "incomplete" and a value means "complete since then", which is
-- one column answering both the status question and the when question.
--
-- "Complete" is the set of fields the site cannot work without for a person who
-- wants to list or enquire about property: a name to address them by, a phone
-- number to reach them on, and a country and city to place them. Email is not in
-- the list because an account always has one — it comes from `auth.users`.
-- -----------------------------------------------------------------------------
create or replace function public.sync_profile_completion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_complete boolean;
begin
  v_complete :=
    nullif(btrim(coalesce(new.full_name, '')), '') is not null
    and nullif(btrim(coalesce(new.phone, '')), '') is not null
    and nullif(btrim(coalesce(new.country_of_residence, '')), '') is not null
    and nullif(btrim(coalesce(new.city, '')), '') is not null;

  if v_complete then
    -- Preserve the original completion time: re-saving a complete profile is not
    -- a second completion, and a timestamp that moves on every edit would make
    -- "completed this month" a meaningless report.
    new.profile_completed_at := coalesce(old.profile_completed_at, now());
  else
    new.profile_completed_at := null;
  end if;

  return new;
end;
$$;

comment on function public.sync_profile_completion is
  'Derives profile_completed_at from the columns (name, phone, country, city) rather than trusting a stored flag.';

-- `old` is not defined on INSERT, so the trigger is split: the INSERT case can
-- only ever complete, never preserve.
create or replace function public.set_profile_completion_on_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(new.full_name, '')), '') is not null
     and nullif(btrim(coalesce(new.phone, '')), '') is not null
     and nullif(btrim(coalesce(new.country_of_residence, '')), '') is not null
     and nullif(btrim(coalesce(new.city, '')), '') is not null
  then
    new.profile_completed_at := now();
  else
    new.profile_completed_at := null;
  end if;

  return new;
end;
$$;

comment on function public.set_profile_completion_on_insert is
  'The INSERT half of the profile-completion derivation. Separate from the UPDATE half because `old` is unavailable on insert.';

drop trigger if exists profiles_set_completion_on_insert on public.profiles;
create trigger profiles_set_completion_on_insert
  before insert on public.profiles
  for each row execute function public.set_profile_completion_on_insert();

drop trigger if exists profiles_sync_completion on public.profiles;
create trigger profiles_sync_completion
  before update of full_name, phone, country_of_residence, city on public.profiles
  for each row execute function public.sync_profile_completion();

-- -----------------------------------------------------------------------------
-- Indexes.
--
-- A country and a region index because both are filter keys for the reporting
-- and admin lists this phase's model makes possible, and a partial index on the
-- incomplete rows because "which accounts still need chasing" is the one query
-- that reads the exception rather than the rule.
-- -----------------------------------------------------------------------------
create index profiles_country_idx on public.profiles (country_iso_code)
  where country_iso_code is not null;

create index profiles_region_idx on public.profiles (region_id)
  where region_id is not null;

create index profiles_incomplete_idx on public.profiles (created_at desc)
  where profile_completed_at is null;

-- -----------------------------------------------------------------------------
-- Row Level Security.
--
-- No policy change is needed and none is added, which is deliberate. The existing
-- `profiles_update_own` policy already lets a user edit their own row and pins
-- `role` to its stored value, so these new columns are editable by their owner and
-- by nobody else. Adding a second policy "for the new columns" would be a policy
-- that grants nothing new while looking like a control.
-- -----------------------------------------------------------------------------
