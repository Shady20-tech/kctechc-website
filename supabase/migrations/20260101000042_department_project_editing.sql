-- =============================================================================
-- Phase 13 — Department-scoped editing of completed work.
--
-- The public gallery already exists: `electrical_projects`, `project_media` and
-- `electrical_project_services` back `/{locale}/{department}/projects` for every
-- department that has services, and a "Work Done" entry point now sits in the
-- department hero. What was missing was a way for the departments to fill it in.
--
-- The write policies were `is_admin()`, which is true for every admin-capable
-- role — a Digital Marketing admin could write an Electrical Services project and
-- vice versa. The work gallery is a claim each department makes about its own
-- track record, so the boundary has to be the department, not the console.
--
-- This migration therefore replaces the three write policies with a
-- department-scoped predicate. The read policies are untouched: a published
-- project stays world-readable, and an unpublished one stays readable to the
-- department that owns it (so its editors can review their own drafts).
--
-- `is_department_editor` mirrors `canAccessDepartment` in `src/lib/auth/roles.ts`:
-- `super_admin` and `department_staff` are cross-department, and every other role
-- is scoped to the department in `ROLE_DEPARTMENTS`. The predicate is defined once
-- and used by all three policies so the three cannot drift apart.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The predicate.
--
-- `security definer` so it reads `profiles` without recursing through that
-- table's own RLS, and `set search_path` so a caller cannot shadow the table it
-- reads. `stable` because it depends only on `auth.uid()` within a statement.
--
-- Returns false for a signed-out caller rather than null, so the policies read
-- as a plain boolean.
-- -----------------------------------------------------------------------------
create or replace function public.is_department_editor(department_slug text)
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
      else false
    end,
    false
  );
$$;

comment on function public.is_department_editor is
  'True when the current user may author content for the named department. Mirrors canAccessDepartment() in src/lib/auth/roles.ts.';

-- -----------------------------------------------------------------------------
-- Replace the write policies on the project tables.
--
-- The department of a project is a property of the project row, so the check is
-- expressed by looking the department up from `department_id`. `is_department_editor`
-- is given the slug, not the id, because that is what the application role model
-- speaks.
-- -----------------------------------------------------------------------------
drop policy if exists "electrical_projects_write_admin" on public.electrical_projects;
create policy "electrical_projects_write_department"
  on public.electrical_projects for all
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_id
        and public.is_department_editor(d.slug)
    )
  )
  with check (
    exists (
      select 1 from public.departments d
      where d.id = department_id
        and public.is_department_editor(d.slug)
    )
  );

-- An unpublished project is readable by the department that owns it, so an editor
-- can see their own draft in the gallery-adjacent review without a second read
-- path. Published rows remain covered by the public select policy.
drop policy if exists "electrical_projects_select_admin" on public.electrical_projects;
create policy "electrical_projects_select_department"
  on public.electrical_projects for select
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_id
        and public.is_department_editor(d.slug)
    )
  );

drop policy if exists "project_media_write_admin" on public.project_media;
create policy "project_media_write_department"
  on public.project_media for all
  to authenticated
  using (
    exists (
      select 1
      from public.electrical_projects p
      join public.departments d on d.id = p.department_id
      where p.id = project_id
        and public.is_department_editor(d.slug)
    )
  )
  with check (
    exists (
      select 1
      from public.electrical_projects p
      join public.departments d on d.id = p.department_id
      where p.id = project_id
        and public.is_department_editor(d.slug)
    )
  );

-- The join is scoped twice: the project must be in a department the caller may
-- edit, *and* the service must belong to that same department. Without the second
-- half the console's service picker is only a UI filter — a crafted POST could
-- attach an Electrical Services service to a Digital Marketing project. The
-- application scopes the options in `loadProjectOptions`, but the boundary has to
-- be here for the two to agree.
drop policy if exists "electrical_project_services_write_admin" on public.electrical_project_services;
create policy "electrical_project_services_write_department"
  on public.electrical_project_services for all
  to authenticated
  using (
    exists (
      select 1
      from public.electrical_projects p
      join public.departments d on d.id = p.department_id
      join public.services s on s.id = service_id
      where p.id = project_id
        and s.department_id = p.department_id
        and public.is_department_editor(d.slug)
    )
  )
  with check (
    exists (
      select 1
      from public.electrical_projects p
      join public.departments d on d.id = p.department_id
      join public.services s on s.id = service_id
      where p.id = project_id
        and s.department_id = p.department_id
        and public.is_department_editor(d.slug)
    )
  );

-- -----------------------------------------------------------------------------
-- Grants.
--
-- The new predicate is called from inside RLS policies, so the role the policy is
-- evaluated as needs EXECUTE on it (Postgres checks EXECUTE for policy functions;
-- see the Phase 12 gotcha). It is granted to both browser roles because the
-- public select policies are evaluated for `anon` too, and it returns false for
-- any caller without a department role.
--
-- The default is revoked explicitly rather than relied upon, so this migration
-- states its own grant surface instead of inheriting whatever Supabase set.
-- -----------------------------------------------------------------------------
revoke all on function public.is_department_editor(text) from public;
grant execute on function public.is_department_editor(text) to anon, authenticated, service_role;
