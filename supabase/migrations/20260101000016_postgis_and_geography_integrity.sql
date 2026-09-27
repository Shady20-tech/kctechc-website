-- =============================================================================
-- Phase 6 — PostGIS, and geography combinations enforced by the database.
--
-- Requirement: "Invalid region/division/subdivision combinations cannot be saved."
--
-- Three approaches were available:
--
--   1. A CHECK constraint. Cannot work: a check may not query another table, so
--      it cannot ask which region a division belongs to.
--   2. A trigger. Works, but only fires on the path that writes the row, and it
--      re-implements a referential rule the database already knows how to enforce.
--   3. Composite foreign keys. The child row carries its ancestors' identifiers,
--      so a mismatched triple has no parent row to reference and the insert is
--      rejected by the FK itself.
--
-- This migration takes the third. It is the only one of the three where the
-- invalid state is unrepresentable rather than merely rejected, and it holds for
-- every writer — a migration, a psql session, the CSV importer, or a future
-- integration — because it is enforced by the storage engine rather than by code
-- that has to remember to run.
--
-- The cost is a little redundancy: `subdivisions` stores `region_id` even though
-- it is derivable from its division, and `property_listings` stores both. That
-- redundancy is what the FKs are made of, and the FKs are what make it impossible
-- for the redundant copy to disagree with the parent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PostGIS.
--
-- Installed into the dedicated `extensions` schema created by migration 1, so
-- PostGIS's several hundred functions are never exposed through `public` and the
-- API surface stays exactly what this application defines.
--
-- Only the core extension is installed. `postgis_topology` refuses to install
-- outside a schema literally named `topology` and brings editing functions for
-- shared geometries — neither is needed to store and index a property's point,
-- so it is deliberately omitted rather than installed for appearance.
-- -----------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;

comment on extension postgis is
  'Spatial types and indexing for property coordinates. Installed in `extensions`, not `public`.';

-- -----------------------------------------------------------------------------
-- Make the hierarchy composable.
--
-- Each level gains a uniqueness constraint on the identity tuple its children
-- will reference. `id` alone is already unique, so these add no new restriction
-- on the data — they exist to give the composite foreign keys a target.
-- -----------------------------------------------------------------------------
alter table public.divisions
  add constraint divisions_id_region_unique unique (id, region_id);

-- `subdivisions` needs to know its region to be referenceable by a composite FK.
-- It is derivable from `division_id`, and that derivation is exactly what is
-- unsafe: nothing currently stops a subdivision's region from being written
-- inconsistently, because the region is not stored at all.
alter table public.subdivisions
  add column region_id uuid references public.regions (id) on delete restrict;

update public.subdivisions s
set region_id = d.region_id
from public.divisions d
where d.id = s.division_id
  and s.region_id is null;

-- Safe to enforce now: the column is populated for every existing row, and the
-- composite FK below keeps it consistent for every future one.
alter table public.subdivisions
  alter column region_id set not null;

alter table public.subdivisions
  add constraint subdivisions_division_region_fkey
    foreign key (division_id, region_id)
    references public.divisions (id, region_id)
    on delete restrict;

alter table public.subdivisions
  add constraint subdivisions_id_division_region_unique
    unique (id, division_id, region_id);

create index subdivisions_region_idx on public.subdivisions (region_id);

comment on column public.subdivisions.region_id is
  'Denormalized from the parent division so a composite FK can forbid a subdivision from being paired with the wrong region. Kept consistent by subdivisions_division_region_fkey.';

-- -----------------------------------------------------------------------------
-- A subdivision's code must be unique within its region, matching the existing
-- per-division rule. Two divisions in one region may legitimately each contain a
-- subdivision of the same name, so this is scoped rather than global.
-- -----------------------------------------------------------------------------
alter table public.subdivisions
  add constraint subdivisions_unique_slug_per_region unique (region_id, slug);
