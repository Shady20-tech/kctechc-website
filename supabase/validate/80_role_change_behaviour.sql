-- =============================================================================
-- Behavioural validation of the console role-change boundary.
--
-- Run after the migrations, on the harness created by `00_supabase_shim.sql`.
--
-- This proves the database half of the super-admin role editor
-- (`src/lib/admin/role-actions.ts` + `/admin/users`). The Server Action checks the
-- caller's role in the application, but that check is a *message*: the control is
-- `profiles_update_super_admin` and the `forbid_self_role_change` trigger. The
-- assertions below bypass the application entirely and speak to the database, so
-- they hold no matter which code path attempts the write.
--
-- The properties asserted:
--
--   * a super administrator may change another account's role;
--   * a lower admin role may not change any role, including their own;
--   * a customer may not promote themselves;
--   * a customer may not promote a different account either;
--   * an anonymous (anon) caller may not change a role at all;
--   * a role outside the enum is refused by the type system;
--   * a super admin's change to another row actually persists.
--
-- One property is deliberately NOT asserted here, because the database does not
-- hold it: **a super administrator may change their own role.** The
-- `forbid_self_role_change` trigger blocks a *non-administrator* only
-- (`is_admin()` is true for `super_admin`), and `profiles_update_super_admin`
-- permits the write. The self-change guard is therefore application-level, in
-- `changeUserRoleAction`, and check 9 records that boundary rather than a refusal
-- so the distinction cannot be mistaken for a database control.
--
-- `request.jwt.claim.sub` is the setting `auth.uid()` reads, and profiles are
-- written directly because `handle_new_user` always provisions a `customer`: a
-- privileged role is granted by an administrator, never self-assigned.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Fixtures: one account per role tier, all inactive-safe and idempotent.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'role-super@example.test'),
  ('c0000000-0000-0000-0000-000000000002', 'role-super-two@example.test'),
  ('c0000000-0000-0000-0000-000000000003', 'role-dm-admin@example.test'),
  ('c0000000-0000-0000-0000-000000000004', 'role-customer@example.test'),
  ('c0000000-0000-0000-0000-000000000005', 'role-target@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, locale)
values
  ('c0000000-0000-0000-0000-000000000001', 'role-super@example.test', 'Super One', 'super_admin', 'en'),
  ('c0000000-0000-0000-0000-000000000002', 'role-super-two@example.test', 'Super Two', 'super_admin', 'en'),
  ('c0000000-0000-0000-0000-000000000003', 'role-dm-admin@example.test', 'DM Admin', 'digital_marketing_admin', 'en'),
  ('c0000000-0000-0000-0000-000000000004', 'role-customer@example.test', 'Customer', 'customer', 'en'),
  ('c0000000-0000-0000-0000-000000000005', 'role-target@example.test', 'Target', 'customer', 'en')
on conflict (id) do update set role = excluded.role;

-- -----------------------------------------------------------------------------
-- 1. A super administrator promotes another account.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$
begin
  update public.profiles
  set role = 'electrical_admin'
  where id = 'c0000000-0000-0000-0000-000000000005';

  if not found then
    raise exception 'VALIDATION FAIL: a super admin could not change another account''s role';
  end if;
  raise notice 'PASS  a super admin changes another account''s role';
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 2. A super administrator CAN change their own role at the database level.
--
-- This is the boundary of the control, recorded so it is not mistaken for a
-- database guarantee. `forbid_self_role_change` only fires for a caller who is
-- not an administrator (`is_admin()` is true for `super_admin`), and
-- `profiles_update_super_admin` allows the write, so the demote-yourself lockout
-- is prevented in `changeUserRoleAction` rather than by RLS. The assertion is
-- therefore that the write SUCCEEDS here — if a future migration tightens the
-- trigger to block self-changes, this check fails and the application guard can be
-- revisited rather than silently duplicated.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$
declare
  v_rows integer;
begin
  update public.profiles
  set role = 'customer'
  where id = 'c0000000-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;

  if v_rows <> 1 then
    raise exception
      'VALIDATION FAIL: expected the DB to permit a super admin self-change (the guard is in the Server Action), but % rows changed', v_rows;
  end if;
  raise notice 'PASS  a super admin self-change is permitted by the database (app-level guard)';
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 3. A lower admin role cannot change a role.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
do $$
declare
  v_rows integer;
begin
  -- `profiles_update_own` lets this account update its OWN row, so the statement
  -- is not a policy violation — it is a no-op the trigger refuses. Either outcome
  -- (0 rows or an exception) proves the boundary, so both are accepted.
  begin
    update public.profiles
    set role = 'super_admin'
    where id = 'c0000000-0000-0000-0000-000000000003';
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      raise exception 'VALIDATION FAIL: a DM admin escalated their own role';
    end if;
    raise notice 'PASS  a DM admin''s self-escalation changed no row';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a DM admin''s self-escalation was refused';
  end;
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 4. A customer cannot promote themselves.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
do $$
declare
  v_rows integer;
begin
  begin
    update public.profiles
    set role = 'super_admin'
    where id = 'c0000000-0000-0000-0000-000000000004';
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      raise exception 'VALIDATION FAIL: a customer promoted themselves to super_admin';
    end if;
    raise notice 'PASS  a customer''s self-promotion changed no row';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a customer''s self-promotion was refused';
  end;
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 5. A customer cannot promote a *different* account either.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
do $$
declare
  v_rows integer;
begin
  update public.profiles
  set role = 'super_admin'
  where id = 'c0000000-0000-0000-0000-000000000005';
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'VALIDATION FAIL: a customer promoted another account';
  end if;
  raise notice 'PASS  a customer cannot promote another account';
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 6. An anonymous caller cannot change a role.
-- -----------------------------------------------------------------------------
begin;
set local role anon;
do $$
declare
  v_rows integer;
begin
  update public.profiles
  set role = 'super_admin'
  where id = 'c0000000-0000-0000-0000-000000000005';
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'VALIDATION FAIL: an anonymous caller changed a role';
  end if;
  raise notice 'PASS  an anonymous caller changes no role';
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 7. A role outside the enum is refused by the type, not stored as text.
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    update public.profiles
    set role = 'owner'
    where id = 'c0000000-0000-0000-0000-000000000005';
    raise exception 'VALIDATION FAIL: an unknown role string was accepted';
  exception
    when invalid_text_representation then
      raise notice 'PASS  an unknown role string is refused by the enum';
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- 8. A super admin's change persists, and the target really holds the new role.
--
-- The previous checks roll back, so this is the one that proves the write is not
-- merely un-refused but actually effective.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);
set local role authenticated;

update public.profiles
set role = 'department_staff'
where id = 'c0000000-0000-0000-0000-000000000005';

do $$
declare
  v_role public.user_role;
begin
  select role into v_role
  from public.profiles
  where id = 'c0000000-0000-0000-0000-000000000005';

  if v_role <> 'department_staff' then
    raise exception 'VALIDATION FAIL: the role change did not persist (found %)', v_role;
  end if;
  raise notice 'PASS  the role change persists on the row';
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 9. A self-change by a NON-super admin is refused by the trigger.
--
-- Check 2 records that a super admin's own change is permitted. This is the other
-- half: the trigger does block a caller who is not an administrator, so a customer
-- or a lower staff role cannot rewrite its own role even though
-- `profiles_update_own` would let it update the row. Asserted separately from
-- check 3 so a future narrowing of `is_admin()` cannot pass one and fail the other
-- unnoticed.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
do $$
begin
  begin
    update public.profiles
    set role = 'super_admin'
    where id = 'c0000000-0000-0000-0000-000000000004';
    raise exception 'VALIDATION FAIL: a customer promoted themselves';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a customer''s self-promotion is refused by the trigger';
  end;
end
$$;
rollback;

select 'ALL ROLE CHANGE VALIDATIONS PASSED' as result;
