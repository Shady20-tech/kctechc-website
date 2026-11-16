-- =============================================================================
-- Phase 2 — Signup account type and the age gate.
--
-- The brief's requirement 2.1: during signup a user chooses an account type —
-- Buyer / Property Seeker, Landlord / Property Owner, or Real Estate Agent.
--
-- ## The declaration is not a capability
--
-- `profiles.declared_account_type` records WHAT THE USER SAID THEY ARE. It is
-- read for exactly two things: to route the user to the right next step after
-- signup, and to show them the state of their application on their account page.
--
-- It is deliberately NOT an authorization input. No RLS policy, guard or
-- predicate in this schema reads it, and there is no code path from it to a
-- membership, an `agent_profiles` row, or any posting permission. The capability
-- that actually permits listing property is `real_estate_memberships.status =
-- 'approved'`, which only `approve_kyc_application` can write.
--
-- The distinction is enforced by a test (`kyc.test.ts` scans the schema for a
-- policy that reads the column) and by the fact that the column is a plain
-- enum on the user's own profile row, which they may edit — a value they can
-- change at will cannot be a permission.
--
-- ## Why the age gate is here as well as on the application
--
-- The KYC application carries the authoritative 18+ CHECK, because that is where
-- identity evidence is reviewed. The signup form also refuses an under-18
-- applicant who declares an intent to become a landlord or an agent, so the
-- person is told immediately rather than after filling in a form. The profile
-- column carries no age constraint: a minor may hold an ordinary buyer account,
-- and only *applying* to publish property requires adulthood.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The vocabulary.
-- -----------------------------------------------------------------------------
create type public.account_type as enum (
  'buyer',
  'landlord',
  'agent'
);

comment on type public.account_type is
  'What a user says they are at signup. A declaration only — it grants no capability and no RLS policy reads it.';

-- -----------------------------------------------------------------------------
-- The profile columns.
-- -----------------------------------------------------------------------------
alter table public.profiles
  -- Nullable: an account created before this migration, or by an administrator,
  -- has no declaration, and a null is honestly "not stated" rather than a
  -- default that would misrepresent the user.
  add column declared_account_type public.account_type,
  add column date_of_birth date;

comment on column public.profiles.declared_account_type is
  'The account type the user selected at signup. A declaration, not a permission: it routes the onboarding and nothing else. The capability to list property is real_estate_memberships.status = ''approved''.';
comment on column public.profiles.date_of_birth is
  'The user''s date of birth, supplied at signup. Used to prefill a KYC application and to refuse an under-18 applicant for a landlord/agent capability. A buyer account carries no age requirement.';

-- A date of birth must be a real date in the past. The 18+ rule is NOT here: it
-- applies to applying for a capability, not to holding a buyer account.
alter table public.profiles
  add constraint profiles_date_of_birth_past check (
    date_of_birth is null or date_of_birth < current_date
  );

-- -----------------------------------------------------------------------------
-- Provisioning.
--
-- `handle_new_user` is replaced to also record the declaration and the date of
-- birth from the signup metadata. Role handling is UNCHANGED: every account is
-- still provisioned as `customer`, and the metadata's `role` key is still
-- ignored entirely. The `account_type` key is read into the declaration column,
-- which is why that column can never be an authorization input — it comes from
-- client-supplied metadata, exactly like the role that migration 24 stopped
-- trusting.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_locale text;
  resolved_locale public.locale_code;
  requested_account_type text;
  resolved_account_type public.account_type;
  requested_dob text;
  resolved_dob date;
begin
  requested_locale := new.raw_user_meta_data ->> 'locale';
  requested_account_type := new.raw_user_meta_data ->> 'account_type';
  requested_dob := new.raw_user_meta_data ->> 'date_of_birth';

  resolved_locale := case
    when requested_locale in ('en', 'fr') then requested_locale::public.locale_code
    else 'en'::public.locale_code
  end;

  -- The declaration is constrained to the closed set, so a junk value becomes
  -- "not stated" rather than breaking the row. It is stored, not acted on.
  resolved_account_type := case
    when requested_account_type in ('buyer', 'landlord', 'agent')
      then requested_account_type::public.account_type
    else null
  end;

  -- A malformed or future date becomes null rather than aborting the signup. The
  -- 18+ rule is checked by the application and again on the KYC application.
  begin
    resolved_dob := nullif(trim(coalesce(requested_dob, '')), '')::date;
  exception
    when others then
      resolved_dob := null;
  end;

  if resolved_dob is not null and resolved_dob >= current_date then
    resolved_dob := null;
  end if;

  insert into public.profiles (
    id, email, full_name, role, locale,
    declared_account_type, date_of_birth
  )
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    -- Always. A privileged role is granted by an administrator, never requested
    -- by the account being created.
    'customer'::public.user_role,
    resolved_locale,
    resolved_account_type,
    resolved_dob
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Provisions a profile as `customer` at signup, recording the declared account type and date of birth. Role is never taken from client-supplied metadata.';

-- `create or replace` preserves the function's ACL, so the Phase 12 hardening
-- revoke on `handle_new_user` (it is a trigger function, which Postgres does not
-- check EXECUTE for) survives this redefinition. Restated here so the intent is
-- explicit rather than implied by the earlier migration.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- -----------------------------------------------------------------------------
-- Assert the outcome.
--
-- The property this migration exists to establish: a signup that declares
-- `landlord` gets a *declaration*, not a capability. The new account holds no
-- membership, and `user_has_membership` — the predicate every ownership policy
-- calls — returns false for it.
-- -----------------------------------------------------------------------------
do $$
declare
  v_user uuid := 'b0000000-0000-0000-0000-0000000000b1';
  v_declared public.account_type;
  v_has_capability boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    v_user,
    'phase2-signup@example.test',
    -- The client can send whatever it likes here; only the declaration is read.
    jsonb_build_object(
      'full_name', 'Phase Two Applicant',
      'account_type', 'landlord',
      'date_of_birth', '1990-05-01',
      'role', 'super_admin'
    )
  )
  on conflict (id) do nothing;

  select declared_account_type, user_has_membership(v_user, 'landlord')
  into v_declared, v_has_capability
  from public.profiles
  where id = v_user;

  if v_declared is distinct from 'landlord'::public.account_type then
    raise exception
      'Phase 2 signup FAILED: the declared account type was not recorded (%)',
      v_declared;
  end if;

  if v_has_capability then
    raise exception
      'Phase 2 signup FAILED: declaring landlord granted a landlord capability';
  end if;

  -- The role is still `customer`, despite the metadata claiming super_admin.
  if (select role from public.profiles where id = v_user) <> 'customer' then
    raise exception
      'Phase 2 signup FAILED: signup metadata granted a privileged role';
  end if;

  delete from public.profiles where id = v_user;
  delete from auth.users where id = v_user;

  raise notice 'Phase 2 signup: account type is a declaration, never a capability';
end
$$;
