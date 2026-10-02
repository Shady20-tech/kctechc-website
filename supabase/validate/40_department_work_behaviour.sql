-- =============================================================================
-- Behavioural validation of department-scoped work authoring.
--
-- Run after the migrations, on the harness created by `00_supabase_shim.sql`.
-- This proves the boundary introduced in
-- `20260101000042_department_project_editing.sql`:
--
--   * a department's staff and admins may author that department's finished work
--     and no other department's;
--   * a customer and an anonymous visitor may not author work at all;
--   * an unpublished record stays invisible to the public and to the wrong
--     department, while a published one is world-readable;
--   * the same scope governs the record's photography, so a child row cannot be
--     attached across the boundary.
--
-- Before the migration the write policies were `is_admin()`, which is true for
-- every admin-capable role — so a Digital Marketing admin could write Electrical
-- Services work. The assertions below are what fail if that regresses.
--
-- `request.jwt.claim.sub` is the setting `auth.uid()` reads, and profiles are
-- written directly because `handle_new_user` always provisions a `customer`: a
-- privileged role is granted by an administrator, never self-assigned.
--
-- Note: psql `:'var'` interpolation does NOT happen inside dollar-quoted `DO`
-- bodies, so the department id is looked up by subquery within those blocks.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Fixtures: departments and users.
-- -----------------------------------------------------------------------------
insert into public.departments (slug, name, accent_color, sort_order, is_active)
values
  ('digital-marketing', 'Digital Marketing', '#1E6FD9', 10, true),
  ('electrical-services', 'Electrical Services', '#B45309', 20, true),
  ('real-estate', 'Real Estate', '#127A5B', 30, true)
on conflict (slug) do nothing;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dm-staff@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'el-staff@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'customer@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'super@example.test'),
  ('55555555-5555-5555-5555-555555555555', 'agent@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, locale)
values
  ('11111111-1111-1111-1111-111111111111', 'dm-staff@example.test', 'DM Staff', 'digital_marketing_staff', 'en'),
  ('22222222-2222-2222-2222-222222222222', 'el-staff@example.test', 'EL Staff', 'electrical_staff', 'en'),
  ('33333333-3333-3333-3333-333333333333', 'customer@example.test', 'Customer', 'customer', 'en'),
  ('44444444-4444-4444-4444-444444444444', 'super@example.test', 'Super', 'super_admin', 'en'),
  ('55555555-5555-5555-5555-555555555555', 'agent@example.test', 'Agent', 'real_estate_agent', 'en')
on conflict (id) do update set role = excluded.role;

select id as dm_id from public.departments where slug = 'digital-marketing' \gset
select id as el_id from public.departments where slug = 'electrical-services' \gset

-- Idempotent fixtures: a re-run against the same database starts clean.
delete from public.electrical_projects
where slug in ('dm-published', 'dm-draft', 'el-published');

-- -----------------------------------------------------------------------------
-- A Digital Marketing staff member authors Digital Marketing work.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.electrical_projects
  (slug, department_id, title, summary, publish_state, published_at)
values
  ('dm-published', :'dm_id'::uuid, 'Search campaign', 'A published Digital Marketing record.', 'published', now()),
  ('dm-draft', :'dm_id'::uuid, 'Draft campaign', 'An unpublished Digital Marketing record.', 'draft', null);

do $$
begin
  if public.is_department_editor('digital-marketing') is not true then
    raise exception 'VALIDATION FAIL: DM staff is not an editor of their own department';
  end if;
  if public.is_department_editor('electrical-services') is not false then
    raise exception 'VALIDATION FAIL: DM staff is an editor of another department';
  end if;
end
$$;
commit;

do $$ begin raise notice 'PASS  a department staff member can create their own department''s work'; end $$;

-- -----------------------------------------------------------------------------
-- The same staff member cannot create another department's work.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.electrical_projects (slug, department_id, title, summary)
    values (
      'dm-cross-dept',
      (select id from public.departments where slug = 'electrical-services'),
      'Cross-department', 'Must be refused.'
    );
    raise exception 'VALIDATION FAIL: DM staff created an Electrical Services project';
  exception
    when insufficient_privilege then
      raise notice 'PASS  DM staff creating Electrical Services work is denied';
  end;
end
$$;
commit;

-- -----------------------------------------------------------------------------
-- An Electrical Services staff member cannot touch Digital Marketing work.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
do $$
declare
  v_updated int;
begin
  update public.electrical_projects set title = 'Hijacked' where slug = 'dm-published';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'VALIDATION FAIL: EL staff updated a DM project (% rows)', v_updated;
  end if;

  delete from public.electrical_projects where slug = 'dm-draft';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'VALIDATION FAIL: EL staff deleted a DM project (% rows)', v_updated;
  end if;
end
$$;
commit;

do $$ begin raise notice 'PASS  an Electrical Services editor cannot update or delete Digital Marketing work'; end $$;

-- -----------------------------------------------------------------------------
-- A customer and a real-estate agent may not author work.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.electrical_projects (slug, department_id, title, summary)
    values (
      'customer-project',
      (select id from public.departments where slug = 'digital-marketing'),
      'Customer', 'Must be refused.'
    );
    raise exception 'VALIDATION FAIL: a customer created a project';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a customer creating work is denied';
  end;
end
$$;
commit;

begin;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.electrical_projects (slug, department_id, title, summary)
    values (
      'agent-project',
      (select id from public.departments where slug = 'digital-marketing'),
      'Agent', 'Must be refused.'
    );
    raise exception 'VALIDATION FAIL: a real-estate agent created a project';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a real-estate agent creating work is denied';
  end;
end
$$;
commit;

-- -----------------------------------------------------------------------------
-- A super_admin is cross-department.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set local role authenticated;
insert into public.electrical_projects
  (slug, department_id, title, summary, publish_state, published_at)
values
  ('el-published', :'el_id'::uuid, 'Substation upgrade', 'A published Electrical Services record.', 'published', now());
commit;

do $$ begin raise notice 'PASS  a super_admin can author work for any department'; end $$;

-- -----------------------------------------------------------------------------
-- Visibility: published is public, draft is not.
-- -----------------------------------------------------------------------------
begin;
set local role anon;
do $$
declare
  v_published int;
  v_draft int;
begin
  select count(*) into v_published from public.electrical_projects where slug = 'dm-published';
  select count(*) into v_draft from public.electrical_projects where slug = 'dm-draft';
  if v_published <> 1 then
    raise exception 'VALIDATION FAIL: anon cannot see a published project (% rows)', v_published;
  end if;
  if v_draft <> 0 then
    raise exception 'VALIDATION FAIL: anon can see an unpublished project (% rows)', v_draft;
  end if;
end
$$;
commit;

-- The owning department sees its own draft; the other does not.
begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$
declare v_draft int;
begin
  select count(*) into v_draft from public.electrical_projects where slug = 'dm-draft';
  if v_draft <> 1 then
    raise exception 'VALIDATION FAIL: DM staff cannot see their own draft (% rows)', v_draft;
  end if;
end
$$;
commit;

begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
do $$
declare v_draft int;
begin
  select count(*) into v_draft from public.electrical_projects where slug = 'dm-draft';
  if v_draft <> 0 then
    raise exception 'VALIDATION FAIL: EL staff can see another department''s draft (% rows)', v_draft;
  end if;
end
$$;
commit;

do $$ begin raise notice 'PASS  a published record is public and an unpublished one is confined to its department'; end $$;

-- -----------------------------------------------------------------------------
-- Child rows follow the parent's department.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
do $$
declare v_dm_id uuid;
begin
  select id into v_dm_id from public.electrical_projects where slug = 'dm-published';
  begin
    insert into public.project_media (project_id, storage_path, alt_text)
    values (v_dm_id, 'projects/x/photo.jpg', 'Cross-department image');
    raise exception 'VALIDATION FAIL: EL staff attached media to a DM project';
  exception
    when insufficient_privilege then
      raise notice 'PASS  attaching photography across departments is denied';
  end;
end
$$;
commit;

begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$
declare v_dm_id uuid;
begin
  select id into v_dm_id from public.electrical_projects where slug = 'dm-published';
  insert into public.project_media (project_id, storage_path, alt_text)
  values (v_dm_id, 'projects/dm/photo.jpg', 'A campaign landing page');
end
$$;
commit;

do $$ begin raise notice 'PASS  photography follows the same department scope as its project'; end $$;

-- -----------------------------------------------------------------------------
-- A service link must belong to the project's own department.
--
-- The console scopes its service picker to the editable departments, but that is
-- a UI filter. A crafted POST could otherwise attach an Electrical Services
-- service to a Digital Marketing project — the join would be meaningless and the
-- public service filter would then offer an option that returns nothing. The
-- policy requires `s.department_id = p.department_id`; this proves it.
-- -----------------------------------------------------------------------------
insert into public.services (id, department_id, slug, title, summary, description, publish_state, published_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', :'dm_id'::uuid, 'dm-seo', 'SEO', 'DM service.', 'DM service.', 'published', now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', :'el_id'::uuid, 'el-wiring', 'Wiring', 'EL service.', 'EL service.', 'published', now())
on conflict (id) do nothing;

begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$
declare
  v_dm_project uuid;
begin
  select id into v_dm_project from public.electrical_projects where slug = 'dm-published';

  -- The same-department link is accepted.
  insert into public.electrical_project_services (project_id, service_id)
  values (v_dm_project, 'aaaaaaaa-0000-0000-0000-000000000001');

  -- The cross-department link is refused by the policy.
  begin
    insert into public.electrical_project_services (project_id, service_id)
    values (v_dm_project, 'aaaaaaaa-0000-0000-0000-000000000002');
    raise exception 'VALIDATION FAIL: DM editor linked an Electrical Services service to a DM project';
  exception
    when insufficient_privilege then
      raise notice 'PASS  linking another department''s service is denied';
  end;
end
$$;
commit;

select 'ALL DEPARTMENT WORK VALIDATIONS PASSED' as result;
