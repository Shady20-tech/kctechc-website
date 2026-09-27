-- =============================================================================
-- Phase 6 — Fix: a new account can no longer choose its own role.
--
-- Found while implementing the phase's role separation. `handle_new_user`, the
-- trigger that provisions a profile at signup, read the requested role out of
-- `raw_user_meta_data` and granted it whenever it was one of a list — and that
-- list included every staff and admin role except `super_admin`:
--
--     'customer', 'real_estate_agent', 'digital_marketing_staff',
--     'digital_marketing_admin', 'electrical_staff', 'electrical_admin',
--     'department_staff'
--
-- `raw_user_meta_data` is supplied by the client at signup and is not
-- authenticated. Any visitor could therefore POST a signup with
-- `{"role": "department_staff"}` and immediately pass `is_admin()`, which grants
-- the internal admin surface, every inquiry in the system, and the audit trail.
-- Verified against a real database before writing this: the account was created
-- with `department_staff` and `is_admin()` returned true.
--
-- The fix removes the capability rather than narrowing the list. Role is an
-- authorization input, and an authorization input must never be accepted from the
-- party it authorizes. Every account is provisioned as `customer`; a privileged
-- role is granted afterwards by an administrator, through a path that is itself
-- audited. There is no self-service case that needs anything else: an agent is
-- hired, not self-declared, and `agent_profiles` is what records that.
--
-- `super_admin` was already excluded, so this closes the gap rather than
-- rewriting the intent — the intent was wrong, not merely incomplete.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Provisioning at signup now grants no role but `customer`.
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
begin
  requested_locale := new.raw_user_meta_data ->> 'locale';

  -- Locale is a presentation preference, not an authorization input, so it is
  -- still accepted from the client. It is constrained to the supported set, so a
  -- junk value falls back to English rather than breaking the row.
  resolved_locale := case
    when requested_locale in ('en', 'fr') then requested_locale::public.locale_code
    else 'en'::public.locale_code
  end;

  insert into public.profiles (id, email, full_name, role, locale)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    -- Always. A privileged role is granted by an administrator, never requested
    -- by the account being created.
    'customer'::public.user_role,
    resolved_locale
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Provisions a profile as `customer` at signup. Role is never taken from client-supplied metadata; administrators grant privileged roles afterwards.';

-- -----------------------------------------------------------------------------
-- Prevent a profile from changing its own role.
--
-- The signup trigger was the way in, but the same escalation is possible through
-- the `profiles` table if a policy allows a user to update their own row: change
-- `role`, and the next request carries the new privileges. RLS is the first line
-- of defence, and a trigger is the second — because a policy can be altered by a
-- later migration and a service-role write bypasses RLS entirely.
--
-- Enforced by comparing against the stored value, not by trusting the request:
-- only a caller who is already an administrator may change a role. `auth.uid()`
-- is null for the service role and for a direct psql session, which is how
-- migrations and the admin client legitimately set a role.
-- -----------------------------------------------------------------------------
create or replace function public.forbid_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role <> old.role then
    -- `is_super_admin()` would be too narrow: the store and electrical admins
    -- also assign roles within their remit. The broader `is_admin()` is the right
    -- question here because it asks "is this caller staff at all", and the
    -- narrower department scoping is applied by the policies on `profiles`.
    --
    -- A null `auth.uid()` means no end-user session: a migration, the service
    -- role, or a psql session. Those are trusted contexts, so the change is
    -- allowed there. This is the same rule the audit triggers rely on.
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'A user may not change their own role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.forbid_self_role_change is
  'Blocks a non-administrator from changing any role, including their own. A trigger as well as an RLS policy, because the service role bypasses RLS.';

drop trigger if exists profiles_forbid_self_role_change on public.profiles;

create trigger profiles_forbid_self_role_change
  before update of role on public.profiles
  for each row execute function public.forbid_self_role_change();

-- -----------------------------------------------------------------------------
-- Confirm the profiles policies do not let a user escalate.
--
-- A user may update their own profile row; the trigger above is what stops that
-- including the role column. The policy is left as it is because it correctly
-- scopes which ROW a user may edit — this migration only narrows which COLUMNS.
-- -----------------------------------------------------------------------------
