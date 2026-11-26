-- =============================================================================
-- `real_estate_staff`: the staff tier of the real-estate department.
--
-- The other two departments already had a two-tier structure — staff and admin —
-- while real estate had only `real_estate_agent` (works their own listings) and
-- `real_estate_admin` (runs the queue and everyone's listings). A property
-- business also employs people who process submissions, answer enquiries and keep
-- the portfolio tidy but who should not be able to act across every listing the
-- way an administrator can. Without this role those people were given
-- `real_estate_admin`, which is a wider grant than their job.
--
-- The tier therefore means what it means in the other departments:
--
--   real_estate_staff   reaches the real-estate console and works the queue,
--                       but is NOT an administrator of the portfolio
--   real_estate_admin   additionally manages every listing and its lifecycle
--   super_admin         additionally decides identity (KYC, verification)
--
-- That split is deliberate and is what `is_real_estate_admin()` encodes: adding
-- staff to that predicate would erase the distinction the role exists to create,
-- so staff is added to `is_department_editor()` (it may author real-estate
-- content) and NOT to `is_real_estate_admin()`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The enum value.
--
-- `add value if not exists` keeps this idempotent.
--
-- PostgreSQL refuses to *use* a new enum value in the transaction that adds it
-- ("unsafe use of new value"). A migration file runs as one transaction, so the
-- functions below compare `current_user_role()::text` against string literals
-- rather than against enum literals. That is the documented workaround and it
-- behaves identically: the role name is the text of the enum value.
-- -----------------------------------------------------------------------------
alter type public.user_role add value if not exists 'real_estate_staff';

-- -----------------------------------------------------------------------------
-- 2. The real-estate console predicate.
--
-- A staff member reaches the department console, so this helper answers "may this
-- caller open the real-estate area at all". It is deliberately NOT
-- `is_real_estate_admin()`, which stays the narrower "may act across the whole
-- portfolio" question.
-- -----------------------------------------------------------------------------
create or replace function public.is_real_estate_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.current_user_role()::text in (
      'real_estate_staff',
      'real_estate_admin',
      'department_staff',
      'super_admin'
    ),
    false
  );
$$;

comment on function public.is_real_estate_staff is
  'True for roles that may open the real-estate console. Broader than is_real_estate_admin(), which additionally allows acting across every listing.';

-- -----------------------------------------------------------------------------
-- 3. Authoring real-estate content.
--
-- `is_department_editor` decides who may author a department's Work Done projects
-- and content. Real estate gained a projects surface with the Work Done phase, so
-- its staff and admin tiers belong here alongside the other departments' tiers.
--
-- Real estate has no store, so this does not grant product authoring — that path
-- is scoped by `products -> product_categories -> departments` and simply finds
-- no real-estate category.
-- -----------------------------------------------------------------------------
create or replace function public.is_department_editor(department_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    case public.current_user_role()::text
      when 'super_admin' then true
      when 'department_staff' then true
      when 'digital_marketing_staff' then department_slug = 'digital-marketing'
      when 'digital_marketing_admin' then department_slug = 'digital-marketing'
      when 'electrical_staff' then department_slug = 'electrical-services'
      when 'electrical_admin' then department_slug = 'electrical-services'
      when 'real_estate_staff' then department_slug = 'real-estate'
      when 'real_estate_admin' then department_slug = 'real-estate'
      else false
    end,
    false
  );
$$;

comment on function public.is_department_editor is
  'True when the current user may author content for the named department. Mirrors canAccessDepartment() in src/lib/auth/roles.ts.';

-- -----------------------------------------------------------------------------
-- 4. Prove the tier split on this database.
--
-- The point of the new role is that it is narrower than the administrator. If a
-- later edit folded it into `is_real_estate_admin()`, every listing in the
-- portfolio would become editable by the staff tier and nothing would report it.
-- -----------------------------------------------------------------------------
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'is_real_estate_admin';

  if v_definition is null then
    raise exception 'is_real_estate_admin() is missing';
  end if;

  if v_definition like '%real_estate_staff%' then
    raise exception
      'is_real_estate_admin() must not include real_estate_staff: the staff tier is not a portfolio administrator';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Classify the new function for the EXECUTE surface.
--
-- Supabase grants EXECUTE to `anon` and `authenticated` on every new public
-- function by default, and the Phase 12 hardening migration ran long before this
-- one existed. A role predicate is called from RLS policies and Server Actions, so
-- `authenticated` needs it; `anon` does not, because no anonymous request is ever
-- staff.
-- -----------------------------------------------------------------------------
revoke all on function public.is_real_estate_staff() from public;
revoke all on function public.is_real_estate_staff() from anon;
grant execute on function public.is_real_estate_staff() to authenticated;
grant execute on function public.is_real_estate_staff() to service_role;
