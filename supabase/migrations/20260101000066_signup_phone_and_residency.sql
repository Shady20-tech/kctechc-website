-- =============================================================================
-- Sign-up phone number and residency declaration.
--
-- The sign-up form collected a name, an email, a password, an account-type
-- declaration and a date of birth. Two facts the marketplace genuinely needs were
-- missing from it and only collectable later, on the account page:
--
--   * a phone number, which is how the team actually contacts a landlord or an
--     agent about a listing; and
--   * whether the person is a permanent resident of the city they are in, which
--     the brief asks for at sign-up.
--
-- Both columns already exist on `profiles` (phone from the identity migration,
-- permanent_residency from 20260101000056). This migration makes them fillable at
-- sign-up by teaching `handle_new_user` to read them from the sign-up metadata,
-- exactly as it already reads `account_type` and `date_of_birth`.
--
-- Three decisions worth stating, because each is a place this could be wrong:
--
--   1. `permanent_residency` becomes NULLABLE with no default. It was
--      `boolean not null default true`, which was fine while it was only ever set
--      on the account page by a person who saw the checkbox. It is not fine for a
--      sign-up field: a default of `true` would silently claim every new account
--      IS a permanent resident, which is a fabricated fact about a person, and a
--      NOT NULL constraint would force the form to send an answer even when the
--      user left it blank. Null is the honest third state — "not stated" — and
--      the account page's checkbox is updated so "unchecked" is stored as an
--      explicit `false` rather than as null, so a stated "no" survives.
--
--   2. The phone value is stored as given, and the existing
--      `profiles_phone_format` CHECK is the only rule applied. `handle_new_user`
--      trims it and treats blank as null; a value that is not a phone number at
--      all is refused by the constraint, which is the same rule the account-page
--      form is held to. No new validation rule is invented here.
--
--   3. Nothing about authorization changes. `handle_new_user` still provisions
--      every account as `customer` and still ignores any `role` key in the
--      metadata. The two new values are profile facts, not permissions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Residency becomes a stated value, not a defaulted one.
-- -----------------------------------------------------------------------------
alter table public.profiles
  alter column permanent_residency drop not null,
  alter column permanent_residency drop default;

comment on column public.profiles.permanent_residency is
  'True when the person is a permanent resident of country_of_residence, false when they have stated they are not, and null when they have not stated it (a fresh sign-up that left the question blank).';

-- -----------------------------------------------------------------------------
-- `handle_new_user` records the phone number and the residency declaration.
--
-- This is a full redefinition, not an amendment, so it must carry forward
-- everything the 20260101000061 version did: the locale resolution, the account
-- type declaration, the date-of-birth parse and — critically — the rule that the
-- role is never read from client-supplied metadata.
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
  requested_phone text;
  resolved_phone text;
  requested_residency text;
  resolved_residency boolean;
begin
  requested_locale := new.raw_user_meta_data ->> 'locale';
  requested_account_type := new.raw_user_meta_data ->> 'account_type';
  requested_dob := new.raw_user_meta_data ->> 'date_of_birth';
  requested_phone := new.raw_user_meta_data ->> 'phone';
  requested_residency := new.raw_user_meta_data ->> 'permanent_residency';

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

  -- Blank is "not given". A value that is not a phone number is left to the
  -- `profiles_phone_format` CHECK to refuse, so there is one rule rather than two.
  resolved_phone := nullif(trim(coalesce(requested_phone, '')), '');

  -- "true"/"false" from the form's radio or checkbox; anything else (including a
  -- missing key) is "not stated", which is the null third state.
  resolved_residency := case
    when requested_residency = 'true' then true
    when requested_residency = 'false' then false
    else null
  end;

  insert into public.profiles (
    id, email, full_name, role, locale,
    declared_account_type, date_of_birth, phone, permanent_residency
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
    resolved_dob,
    resolved_phone,
    resolved_residency
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Provisions a profile as `customer` at signup, recording the declared account type, date of birth, phone number and residency declaration. Role is never taken from client-supplied metadata.';

-- `create or replace` preserves the function's ACL, so the Phase 12 hardening
-- revoke survives this redefinition. Restated so the intent is explicit.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- -----------------------------------------------------------------------------
-- Self-test: the metadata round-trip, on the migration that introduces it.
--
-- A trigger function's behaviour is invisible to TypeScript and to every unit
-- test, so the boundary is proven here — the same pattern migration 62 uses. The
-- fixture is cleaned up completely, including the translation rows an inserted
-- profile would not create but a listing would; here only the auth user and its
-- cascaded profile exist, and deleting the auth row removes both.
-- -----------------------------------------------------------------------------
do $$
declare
  v_stated uuid := gen_random_uuid();
  v_blank uuid := gen_random_uuid();
  v_phone text;
  v_residency boolean;
  v_role public.user_role;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    v_stated, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'signup-probe@kctechc.test', 'x',
    '{}'::jsonb,
    jsonb_build_object(
      'full_name', 'Signup Probe',
      'account_type', 'landlord',
      'date_of_birth', '1990-01-01',
      'phone', '+237 679 202 265',
      'permanent_residency', 'true'
    ),
    now(), now()
  );

  select phone, permanent_residency, role
    into v_phone, v_residency, v_role
  from public.profiles where id = v_stated;

  if v_phone is distinct from '+237 679 202 265' then
    raise exception 'handle_new_user did not record the phone number (got %)', v_phone;
  end if;
  if v_residency is distinct from true then
    raise exception 'handle_new_user did not record the residency declaration (got %)', v_residency;
  end if;
  -- The escalation guard must still hold after the redefinition.
  if v_role is distinct from 'customer'::public.user_role then
    raise exception 'handle_new_user granted a non-customer role (%)', v_role;
  end if;

  -- A second account that leaves the question blank must store null, not true.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    v_blank, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'signup-probe-blank@kctechc.test', 'x',
    '{}'::jsonb,
    jsonb_build_object('full_name', 'Signup Probe Blank'),
    now(), now()
  );

  select permanent_residency into v_residency
  from public.profiles where id = v_blank;

  if v_residency is not null then
    raise exception 'an unstated residency must be null, not %', v_residency;
  end if;

  -- The profiles rows cascade with their auth users.
  delete from auth.users where id in (v_stated, v_blank);
end $$;
