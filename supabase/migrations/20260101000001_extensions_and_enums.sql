-- =============================================================================
-- KC Technology Corporation — extensions, enums and shared helpers
-- =============================================================================

-- Extensions live in a dedicated schema so extension internals are never
-- exposed through `public` (PostGIS arrives in a later phase under `extensions`).
create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Must stay in sync with APP_ROLES in src/lib/auth/roles.ts.
create type public.user_role as enum (
  'visitor',
  'customer',
  'real_estate_agent',
  'digital_marketing_staff',
  'digital_marketing_admin',
  'electrical_staff',
  'electrical_admin',
  'department_staff',
  'super_admin'
);

create type public.locale_code as enum ('en', 'fr');

create type public.publish_state as enum ('draft', 'published', 'archived');

create type public.translation_state as enum (
  'missing', 'pending', 'in_progress', 'translated', 'reviewed', 'outdated'
);

create type public.sync_state as enum (
  'not_required', 'queued', 'syncing', 'synced', 'failed'
);

create type public.translatable_entity_type as enum (
  'department', 'service', 'product', 'category',
  'electrical_project', 'property_listing', 'insight', 'site_setting'
);

-- -----------------------------------------------------------------------------
-- Shared trigger: maintain updated_at without relying on application code.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
