-- =============================================================================
-- Identity: profiles, role helpers, and signup provisioning
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext,
  full_name text,
  role public.user_role not null default 'customer',
  locale public.locale_code not null default 'en',
  phone text,
  avatar_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (
    full_name is null or char_length(full_name) between 1 and 200
  ),
  constraint profiles_phone_length check (
    phone is null or char_length(phone) between 5 and 32
  )
);

comment on table public.profiles is
  'Application profile for each authenticated user. Role is the authoritative authorization input.';

create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (email);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Security-definer helpers.
--
-- SECURITY DEFINER lets a policy read `profiles` without re-triggering the
-- policy on `profiles`, which is the standard way to avoid recursive policy
-- evaluation. `search_path` is pinned so the function cannot be hijacked by a
-- caller-controlled schema.
-- -----------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.current_user_role() in (
      'real_estate_agent',
      'digital_marketing_staff',
      'digital_marketing_admin',
      'electrical_staff',
      'electrical_admin',
      'department_staff',
      'super_admin'
    ),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() = 'super_admin', false);
$$;

-- Cross-department roles may act anywhere; the rest are scoped by this mapping,
-- which mirrors ROLE_DEPARTMENTS in src/lib/auth/roles.ts.
create or replace function public.can_access_department(department_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    case public.current_user_role()
      when 'super_admin' then true
      when 'department_staff' then true
      when 'digital_marketing_staff' then department_slug = 'digital-marketing'
      when 'digital_marketing_admin' then department_slug = 'digital-marketing'
      when 'electrical_staff' then department_slug = 'electrical-services'
      when 'electrical_admin' then department_slug = 'electrical-services'
      when 'real_estate_agent' then department_slug = 'real-estate'
      else false
    end,
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- Provision a profile whenever a user is created (signup or admin invite).
--
-- The role is read from invited-user metadata when present, but only an allowed
-- value is accepted; anything else falls back to `customer`, so a crafted signup
-- payload cannot self-assign a privileged role.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text;
  resolved_role public.user_role;
  requested_locale text;
  resolved_locale public.locale_code;
begin
  requested_role := new.raw_user_meta_data ->> 'role';
  requested_locale := new.raw_user_meta_data ->> 'locale';

  resolved_role := case
    when requested_role in (
      'customer',
      'real_estate_agent',
      'digital_marketing_staff',
      'digital_marketing_admin',
      'electrical_staff',
      'electrical_admin',
      'department_staff'
    ) then requested_role::public.user_role
    else 'customer'::public.user_role
  end;

  resolved_locale := case
    when requested_locale in ('en', 'fr') then requested_locale::public.locale_code
    else 'en'::public.locale_code
  end;

  insert into public.profiles (id, email, full_name, role, locale)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    resolved_role,
    resolved_locale
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- A user may update their own row, but `with check` pins `role` to its stored
-- value so self-service profile edits cannot escalate privileges.
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

create policy "profiles_update_super_admin"
  on public.profiles for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
