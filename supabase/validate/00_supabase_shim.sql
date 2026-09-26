-- =============================================================================
-- Local validation harness for the KC Technology migrations.
--
-- NOT a migration. This file recreates the parts of a Supabase project that the
-- migrations depend on (the `auth` schema, the `anon`/`authenticated` roles, and
-- `auth.uid()`), so the real migration SQL and its RLS policies can be executed
-- and exercised against a plain PostgreSQL 17 instance when Docker/Supabase is
-- unavailable.
--
-- It is applied before the migrations and is never shipped.
-- =============================================================================

create schema if not exists auth;

-- Supabase's role set. `anon` and `authenticated` are the two the policies
-- target; `service_role` bypasses RLS, which is how the server-only client acts.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin nologin noinherit;
  end if;
end
$$;

-- Minimal stand-in for Supabase's auth.users. Only the columns the migrations
-- reference are present.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- `auth.uid()` reads the request-scoped setting that PostgREST sets. Tests
-- override it with `set local request.jwt.claim.sub = '<uuid>'` to act as a user.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), 'anon');
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants table/function access to the API roles by default, and RLS is
-- what actually restricts rows. Replicating that here means a missing GRANT in a
-- migration would surface as a permission error rather than being masked, and the
-- RLS policies under test are the only thing filtering results.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
