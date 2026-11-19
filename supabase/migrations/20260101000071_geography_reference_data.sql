-- =============================================================================
-- Geography reference data: one source of truth for every location input
--
-- Goal: no posting or filtering surface should let a person *type* a region,
-- division or subdivision. Each is a pick from these tables, and the database
-- refuses a combination that does not exist.
--
-- Written to be applied to a database that ALREADY holds the hierarchy seeded
-- by `20260101000055_cameroon_divisions_and_subdivisions.sql` (production
-- included). Every statement is guarded or idempotent, so it is a no-op on an
-- up-to-date database and safe to run twice.
--
-- ---------------------------------------------------------------------------
-- Why the supplied CSVs are a name correction, not a second dataset
-- ---------------------------------------------------------------------------
-- `cameroon_regions.csv`, `cameroon_divisions.csv` and `cameroon_subdivisions.csv`
-- describe the same 10 / 58 / 360 hierarchy that migration 55 seeded (verified
-- row-for-row: identical division name set, and identical (division,
-- subdivision) pairs once diacritics are folded). Source of both: "Cameroon
-- Administrative Divisions", Open Admin Data,
-- https://github.com/open-admin-data/cameroon-administrative-divisions,
-- licensed CC BY 4.0. They differ in two ways:
--
--   1. CODES. The CSVs use `CM-AD` / `CM-AD-DJE` / `CM-AD-DJE-01`; production
--      uses `AD` / `CM001001` / `CM001001001`. The codes are NOT adopted.
--      They are already referenced by `property_listings`, `inquiries`,
--      `agent_profiles`, `electrical_projects`, `geo_landing_content` and the
--      listing-import format, and `regions.code` additionally carries a
--      `^[A-Z]{2,4}$` check that `CM-AD` fails. Re-coding would break every
--      stored row for no user-visible gain: the app selects and links by
--      `slug`, and a code is an internal key.
--
--   2. NAMES. The CSVs are correctly accented where migration 55 lost the
--      diacritics (`Ngaoundere` -> `Ngaoundéré`, `Bangangte` -> `Bangangté`,
--      `Nyete` -> `Nyété`) and hyphenated where it wrote a space
--      (`Ekondo Titi` -> `Ekondo-Titi`, `Upper Bayang` -> `Upper-Bayang`).
--      Those ARE adopted: they are what a user actually types into a search
--      box, and a mangled place name is a visible defect. Slugs are untouched,
--      so no filtered or localized URL changes.
--
-- Two CSV rows are deliberately NOT applied:
--   * `CM-ES-LD` "Lom-et-Djerem" is UNaccented, while the stored
--     `Lom-et-Djérem` is correct. Applying it would be a regression.
--   * `CM-CE-NS` "Nyong-et-So'o" differs from the stored `Nyong-et-So'o` only
--     in apostrophe style (typographic vs ASCII). Nothing a user would notice,
--     and this repository stores ASCII apostrophes.
--
-- `cameroon_regions.csv` changes nothing at all. Its ten rows carry the same
-- names and French names as the stored rows; the only differences are the code
-- scheme above, and the hyphenation of "North-West" / "South-West", where the
-- business brief's own wording ("Northwest", "Southwest") matches what is
-- stored. The brief wins over the CSV for a business-facing spelling.
--
-- ---------------------------------------------------------------------------
-- What this migration adds
-- ---------------------------------------------------------------------------
--   A. The accented / hyphenated names above (34 rows).
--   B. Division + subdivision columns on the four tables that only stored a
--      region, so a landlord, an agent, an electrical project, a quote request
--      and a profile can all be placed at the same depth as a listing.
--   C. Composite foreign keys and depth checks on those columns, so a
--      subdivision that does not belong to the chosen division is refused by
--      the database rather than by whichever form happens to be posting.
--   D. `geography_reference_tree()`, one round trip returning the whole
--      hierarchy for the selectors, replacing three client-side reads.
--   E. Trust language on the geography tables, so a UI label cannot overstate
--      what these rows mean (administrative names, not proof of title).
--
-- Deliberately NOT done here:
--   * `property_listings.locality` stays free text. A neighbourhood or quarter
--     is not an administrative level in this dataset, and inventing a
--     `neighbourhoods` table would be fabricating geography.
--   * `property_listings` already had division/subdivision; apart from the name
--     corrections it is untouched.
--   * Only one function is created and it is read-only; it is classified for
--     the browser at the foot of this file per the Phase 12 EXECUTE rule.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- A. Name corrections from the supplied dataset.
--
-- Each statement is scoped to the row it corrects *and* to the stale name, so
-- it is a no-op on an already-corrected database and can never rewrite a name
-- that has since been edited by hand.
-- -----------------------------------------------------------------------------
update public.subdivisions set name = 'Galim-Tignère', name_fr = 'Galim-Tignère'
 where code = 'CM001002001' and name = 'Galim-Tignere';
update public.subdivisions set name = 'Mayo-Baléo', name_fr = 'Mayo-Baléo'
 where code = 'CM001002003' and name = 'Mayo-Baleo';
update public.subdivisions set name = 'Tignère', name_fr = 'Tignère'
 where code = 'CM001002004' and name = 'Tignere';
update public.subdivisions set name = 'Mayo-Darlé', name_fr = 'Mayo-Darlé'
 where code = 'CM001003003' and name = 'Mayo-Darle';
update public.subdivisions set name = 'Mbé', name_fr = 'Mbé'
 where code = 'CM001005003' and name = 'Mbe';
update public.subdivisions set name = 'Ngaoundéré 1er', name_fr = 'Ngaoundéré 1er'
 where code = 'CM001005005' and name = 'Ngaoundere 1er';
update public.subdivisions set name = 'Ngaoundéré 2e', name_fr = 'Ngaoundéré 2e'
 where code = 'CM001005006' and name = 'Ngaoundere 2e';
update public.subdivisions set name = 'Ngaoundéré 3e', name_fr = 'Ngaoundéré 3e'
 where code = 'CM001005007' and name = 'Ngaoundere 3e';
update public.subdivisions set name = 'Lembe-Yezoum', name_fr = 'Lembe-Yezoum'
 where code = 'CM002001002' and name = 'Lembe Yezoum';
update public.subdivisions set name = 'Monatélé', name_fr = 'Monatélé'
 where code = 'CM002002006' and name = 'Monatele';
update public.subdivisions set name = 'Sa''a', name_fr = 'Sa''a'
 where code = 'CM002002009' and name = 'Saa';
update public.subdivisions set name = 'Kon-Yambetta', name_fr = 'Kon-Yambetta'
 where code = 'CM002003005' and name = 'Kon Yambetta';
update public.subdivisions set name = 'Yaoundé 1er', name_fr = 'Yaoundé 1er'
 where code = 'CM002007001' and name = 'Yaounde 1er';
update public.subdivisions set name = 'Yaoundé 2e', name_fr = 'Yaoundé 2e'
 where code = 'CM002007002' and name = 'Yaounde 2e';
update public.subdivisions set name = 'Yaoundé 3e', name_fr = 'Yaoundé 3e'
 where code = 'CM002007003' and name = 'Yaounde 3e';
update public.subdivisions set name = 'Yaoundé 4e', name_fr = 'Yaoundé 4e'
 where code = 'CM002007004' and name = 'Yaounde 4e';
update public.subdivisions set name = 'Yaoundé 5e', name_fr = 'Yaoundé 5e'
 where code = 'CM002007005' and name = 'Yaounde 5e';
update public.subdivisions set name = 'Yaoundé 6e', name_fr = 'Yaoundé 6e'
 where code = 'CM002007006' and name = 'Yaounde 6e';
update public.subdivisions set name = 'Yaoundé 7e', name_fr = 'Yaoundé 7e'
 where code = 'CM002007007' and name = 'Yaounde 7e';
update public.subdivisions set name = 'Eséka', name_fr = 'Eséka'
 where code = 'CM002008005' and name = 'Eseka';
update public.subdivisions set name = 'Kaélé', name_fr = 'Kaélé'
 where code = 'CM004004002' and name = 'Kaele';
update public.subdivisions set name = 'Edéa 1er', name_fr = 'Edéa 1er'
 where code = 'CM005003003' and name = 'Edea 1er';
update public.subdivisions set name = 'Edéa 2e', name_fr = 'Edéa 2e'
 where code = 'CM005003004' and name = 'Edea 2e';
update public.subdivisions set name = 'Tcholliré', name_fr = 'Tcholliré'
 where code = 'CM006004003' and name = 'Tchollire';
update public.subdivisions set name = 'Zoétélé', name_fr = 'Zoétélé'
 where code = 'CM009001008' and name = 'Zoetele';
update public.subdivisions set name = 'Mvangan', name_fr = 'Mvangan'
 where code = 'CM009002007' and name = 'Mvangane';
update public.subdivisions set name = 'Nyété', name_fr = 'Nyété'
 where code = 'CM009003009' and name = 'Niete';
update public.subdivisions set name = 'Kyé-Ossi', name_fr = 'Kyé-Ossi'
 where code = 'CM009004002' and name = 'Kye-Ossi';
update public.subdivisions set name = 'Ma''an', name_fr = 'Ma''an'
 where code = 'CM009004003' and name = 'Maan';
update public.subdivisions set name = 'Eyumojock', name_fr = 'Eyumojock'
 where code = 'CM010004002' and name = 'Eyumodjock';
update public.subdivisions set name = 'Upper-Bayang', name_fr = 'Upper-Bayang'
 where code = 'CM010004004' and name = 'Upper Bayang';
update public.subdivisions set name = 'Ekondo-Titi', name_fr = 'Ekondo-Titi'
 where code = 'CM010006003' and name = 'Ekondo Titi';
update public.subdivisions set name = 'Bangangté', name_fr = 'Bangangté'
 where code = 'CM008007001' and name = 'Bangangte';
update public.subdivisions set name = 'Malentouen', name_fr = 'Malentouen'
 where code = 'CM008008007' and name = 'Malantouen';

-- -----------------------------------------------------------------------------
-- B. Division + subdivision on the tables that only had a region.
--
-- Every column is nullable: an existing row is not invalidated, and a record
-- may legitimately be captured before the deeper level is known. `on delete
-- restrict` matches the hierarchy's own rule — a division with records attached
-- cannot be deleted out from under them.
-- -----------------------------------------------------------------------------
alter table public.electrical_projects
  add column if not exists division_id uuid,
  add column if not exists subdivision_id uuid;

alter table public.agent_profiles
  add column if not exists division_id uuid,
  add column if not exists subdivision_id uuid;

alter table public.inquiries
  add column if not exists division_id uuid,
  add column if not exists subdivision_id uuid;

alter table public.profiles
  add column if not exists division_id uuid,
  add column if not exists subdivision_id uuid;

-- -----------------------------------------------------------------------------
-- C. Integrity: the three levels must agree.
--
-- A plain `references` per column would allow a subdivision from one division
-- to sit beside a division from another. The composite keys below make the
-- (child, parent) pair itself the reference, so an inconsistent triple has no
-- matching parent row and is rejected by the database.
--
-- The target unique constraints already exist from
-- `20260101000016_postgis_and_geography_integrity.sql`:
--   divisions    unique (id, region_id)
--   subdivisions unique (id, division_id, region_id)
--
-- MATCH SIMPLE caveat: a composite FK is not enforced when any of its columns is
-- NULL, so a row carrying a subdivision but no division would slip through. The
-- `*_geography_depth` checks close that by keeping the depth contiguous.
-- -----------------------------------------------------------------------------

alter table public.electrical_projects
  drop constraint if exists electrical_projects_division_fkey,
  drop constraint if exists electrical_projects_subdivision_fkey,
  drop constraint if exists electrical_projects_geography_depth;

alter table public.electrical_projects
  add constraint electrical_projects_division_fkey
    foreign key (division_id, region_id)
    references public.divisions (id, region_id)
    on delete restrict,
  add constraint electrical_projects_subdivision_fkey
    foreign key (subdivision_id, division_id, region_id)
    references public.subdivisions (id, division_id, region_id)
    on delete restrict,
  add constraint electrical_projects_geography_depth check (
    subdivision_id is null or division_id is not null
  );

alter table public.agent_profiles
  drop constraint if exists agent_profiles_division_fkey,
  drop constraint if exists agent_profiles_subdivision_fkey,
  drop constraint if exists agent_profiles_geography_depth;

alter table public.agent_profiles
  add constraint agent_profiles_division_fkey
    foreign key (division_id, region_id)
    references public.divisions (id, region_id)
    on delete restrict,
  add constraint agent_profiles_subdivision_fkey
    foreign key (subdivision_id, division_id, region_id)
    references public.subdivisions (id, division_id, region_id)
    on delete restrict,
  add constraint agent_profiles_geography_depth check (
    subdivision_id is null or division_id is not null
  );

alter table public.inquiries
  drop constraint if exists inquiries_division_fkey,
  drop constraint if exists inquiries_subdivision_fkey,
  drop constraint if exists inquiries_geography_depth;

alter table public.inquiries
  add constraint inquiries_division_fkey
    foreign key (division_id, region_id)
    references public.divisions (id, region_id)
    on delete restrict,
  add constraint inquiries_subdivision_fkey
    foreign key (subdivision_id, division_id, region_id)
    references public.subdivisions (id, division_id, region_id)
    on delete restrict,
  add constraint inquiries_geography_depth check (
    subdivision_id is null or division_id is not null
  );

alter table public.profiles
  drop constraint if exists profiles_division_fkey,
  drop constraint if exists profiles_subdivision_fkey,
  drop constraint if exists profiles_geography_depth;

alter table public.profiles
  add constraint profiles_division_fkey
    foreign key (division_id, region_id)
    references public.divisions (id, region_id)
    on delete restrict,
  add constraint profiles_subdivision_fkey
    foreign key (subdivision_id, division_id, region_id)
    references public.subdivisions (id, division_id, region_id)
    on delete restrict,
  add constraint profiles_geography_depth check (
    subdivision_id is null or division_id is not null
  );

-- Indexes for the filters that will join on the deeper levels.
create index if not exists electrical_projects_division_idx
  on public.electrical_projects (division_id);
create index if not exists electrical_projects_subdivision_idx
  on public.electrical_projects (subdivision_id);
create index if not exists agent_profiles_division_idx
  on public.agent_profiles (division_id);
create index if not exists agent_profiles_subdivision_idx
  on public.agent_profiles (subdivision_id);
create index if not exists inquiries_division_idx
  on public.inquiries (division_id);
create index if not exists inquiries_subdivision_idx
  on public.inquiries (subdivision_id);
create index if not exists profiles_division_idx
  on public.profiles (division_id);

comment on column public.electrical_projects.division_id is
  'Administrative division, when known. Must belong to region_id (composite FK).';
comment on column public.electrical_projects.subdivision_id is
  'Administrative subdivision, when known. Must belong to division_id and region_id (composite FK).';
comment on column public.agent_profiles.division_id is
  'Division the agent primarily serves, when known. Must belong to region_id.';
comment on column public.agent_profiles.subdivision_id is
  'Subdivision the agent primarily serves, when known. Must belong to division_id and region_id.';
comment on column public.inquiries.division_id is
  'Division the enquiry is about, when known. Must belong to region_id.';
comment on column public.inquiries.subdivision_id is
  'Subdivision the enquiry is about, when known. Must belong to division_id and region_id.';
comment on column public.profiles.division_id is
  'Division of residence, when known. Must belong to region_id.';
comment on column public.profiles.subdivision_id is
  'Subdivision of residence, when known. Must belong to division_id and region_id.';

-- -----------------------------------------------------------------------------
-- C2. The deletion path.
--
-- `region_id` on these four tables is `on delete set null`, while the new
-- division/subdivision FKs are `on delete restrict`. On its own that leaves a
-- hole: deleting a region nulls `region_id`, which (MATCH SIMPLE) silently
-- disables the composite FK, so the row keeps a `division_id` pointing into the
-- region that no longer exists. The trigger clears the deeper levels whenever the
-- region is cleared, so a row can never hold a child without its parent.
--
-- Written as a trigger rather than a second CHECK because the column list is
-- shared by four tables and the rule is "keep the depth contiguous", which reads
-- better in one place than in four near-identical constraints.
-- -----------------------------------------------------------------------------
create or replace function public.clear_deeper_geography_on_region_clear()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.region_id is null then
    new.division_id := null;
    new.subdivision_id := null;
  end if;
  return new;
end
$$;

comment on function public.clear_deeper_geography_on_region_clear() is
  'Keeps region -> division -> subdivision contiguous when a region is cleared (on delete set null). Without it a row could keep a division after its region was removed.';

revoke all on function public.clear_deeper_geography_on_region_clear() from public;
revoke all on function public.clear_deeper_geography_on_region_clear() from anon, authenticated;

drop trigger if exists electrical_projects_clear_geography on public.electrical_projects;
create trigger electrical_projects_clear_geography
  before update of region_id on public.electrical_projects
  for each row execute function public.clear_deeper_geography_on_region_clear();

drop trigger if exists agent_profiles_clear_geography on public.agent_profiles;
create trigger agent_profiles_clear_geography
  before update of region_id on public.agent_profiles
  for each row execute function public.clear_deeper_geography_on_region_clear();

drop trigger if exists inquiries_clear_geography on public.inquiries;
create trigger inquiries_clear_geography
  before update of region_id on public.inquiries
  for each row execute function public.clear_deeper_geography_on_region_clear();

drop trigger if exists profiles_clear_geography on public.profiles;
create trigger profiles_clear_geography
  before update of region_id on public.profiles
  for each row execute function public.clear_deeper_geography_on_region_clear();

-- -----------------------------------------------------------------------------
-- D. One read for the whole hierarchy.
--
-- The selectors need regions, their divisions and their subdivisions together;
-- three separate PostgREST round trips are three chances to render a half-built
-- cascade. This returns the joined rows in one call, ordered so a client can
-- group them without sorting.
--
-- `security invoker` on purpose: it reads only tables whose RLS already allows
-- public select, so it cannot become a way to read anything a plain query could
-- not. It is granted to `anon` and `authenticated` because a public filter
-- needs it, and that grant is deliberate and narrow.
-- -----------------------------------------------------------------------------
create or replace function public.geography_reference_tree()
returns table (
  region_id uuid,
  region_code text,
  region_name text,
  region_name_fr text,
  region_slug text,
  division_id uuid,
  division_code text,
  division_name text,
  division_name_fr text,
  division_slug text,
  subdivision_id uuid,
  subdivision_code text,
  subdivision_name text,
  subdivision_name_fr text,
  subdivision_slug text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    r.id, r.code, r.name, r.name_fr, r.slug,
    d.id, d.code, d.name, d.name_fr, d.slug,
    s.id, s.code, s.name, s.name_fr, s.slug
  from public.regions r
  left join public.divisions d on d.region_id = r.id
  left join public.subdivisions s on s.division_id = d.id
  order by r.sort_order, r.name, d.name, s.name;
$$;

comment on function public.geography_reference_tree() is
  'The full Region -> Division -> Subdivision reference tree in one read, for the location selectors. Security invoker: RLS on the three geography tables is the access control.';

-- The function is `security invoker`, so it runs with the caller's own table
-- privileges. State them explicitly rather than relying on a bootstrap default,
-- so a fresh database built only from migrations can call it. The RLS policies
-- from `20260101000004_geography.sql` already permit public select on all three
-- tables, so this grant adds no reach the policies did not already allow.
grant select on public.regions to anon, authenticated;
grant select on public.divisions to anon, authenticated;
grant select on public.subdivisions to anon, authenticated;

revoke all on function public.geography_reference_tree() from public;
revoke all on function public.geography_reference_tree() from anon, authenticated;
grant execute on function public.geography_reference_tree() to anon, authenticated;
grant execute on function public.geography_reference_tree() to service_role;

-- -----------------------------------------------------------------------------
-- E. Say what these rows are, and are not.
--
-- The marketplace shows a "verified" badge for identity-checked publishers. It
-- must never be read as a guarantee of land title: these tables are
-- administrative place names, nothing more.
-- -----------------------------------------------------------------------------
comment on table public.regions is
  'Cameroon administrative regions (the ten official regions). Reference data for location selectors and filters. A place name only: it conveys no information about land ownership or legal title.';
comment on table public.divisions is
  'Administrative divisions, each belonging to one region. Reference data; no ownership or title implication.';
comment on table public.subdivisions is
  'Administrative subdivisions, each belonging to one division and (denormalized) region. Reference data; no ownership or title implication.';

comment on column public.regions.name is
  'English display name. Selected by slug, never by name, so a correction here cannot break a stored reference.';
comment on column public.regions.name_fr is
  'French display name. Falls back to `name` when null.';

-- -----------------------------------------------------------------------------
-- Assertions: prove the invariants on every application of this migration.
--
-- These read the live data, so they fail the migration (rolling back the whole
-- transaction) if the hierarchy is not the shape the application assumes.
-- -----------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.regions;
  if v_count <> 10 then
    raise exception 'GEOGRAPHY FAIL: expected 10 regions, found %', v_count;
  end if;

  select count(*) into v_count from public.divisions;
  if v_count <> 58 then
    raise exception 'GEOGRAPHY FAIL: expected 58 divisions, found %', v_count;
  end if;

  select count(*) into v_count from public.subdivisions;
  if v_count <> 360 then
    raise exception 'GEOGRAPHY FAIL: expected 360 subdivisions, found %', v_count;
  end if;

  -- No orphan subdivision: every one resolves to a division in its own region.
  select count(*) into v_count
    from public.subdivisions s
    join public.divisions d on d.id = s.division_id
   where s.region_id <> d.region_id;
  if v_count <> 0 then
    raise exception 'GEOGRAPHY FAIL: % subdivisions are mis-parented', v_count;
  end if;

  -- The accented corrections actually landed.
  select count(*) into v_count
    from public.subdivisions
   where name in ('Ngaoundéré 1er', 'Bangangté', 'Nyété', 'Ekondo-Titi');
  if v_count <> 4 then
    raise exception 'GEOGRAPHY FAIL: expected the accented names, found % of 4', v_count;
  end if;

  -- The new columns exist and are nullable, so no existing row was invalidated.
  select count(*) into v_count
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('electrical_projects', 'agent_profiles', 'inquiries', 'profiles')
     and column_name in ('division_id', 'subdivision_id')
     and is_nullable = 'YES';
  if v_count <> 8 then
    raise exception 'GEOGRAPHY FAIL: expected 8 nullable geography columns, found %', v_count;
  end if;

  raise notice 'PASS  geography reference data corrected and referenced by four tables';
end
$$;

commit;
