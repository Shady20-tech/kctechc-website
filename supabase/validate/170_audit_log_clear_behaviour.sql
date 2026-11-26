-- =============================================================================
-- Behavioural validation of the super-admin audit-log clear.
--
-- Proves the database half of `/admin/logs` + `clearAuditLogsAction`:
--
--   * authenticated has DELETE on audit_logs, but a non-super-admin deletes
--     nothing because `audit_logs_delete_super_admin` refuses the rows;
--   * a super-admin deletes the rows;
--   * anon deletes nothing, whether it is refused by the grant or by the policy;
--   * the policy is the one migration 85 declares.
--
-- Run after the migrations, on the harness created by `00_supabase_shim.sql`.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Fixtures. Audit rows have no actor so the auth fixtures can be removed without
-- touching the rows under test.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'log-clear-super@example.test'),
  ('d0000000-0000-0000-0000-000000000002', 'log-clear-admin@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, locale)
values
  ('d0000000-0000-0000-0000-000000000001', 'log-clear-super@example.test', 'Log Super', 'super_admin', 'en'),
  ('d0000000-0000-0000-0000-000000000002', 'log-clear-admin@example.test', 'Log Admin', 'digital_marketing_admin', 'en')
on conflict (id) do update set role = excluded.role;

delete from public.audit_logs where action = 'validation_log';
insert into public.audit_logs (actor_id, action, entity_type, metadata)
values
  (null, 'validation_log', 'validation', '{"case":"clear"}'::jsonb),
  (null, 'validation_log', 'validation', '{"case":"clear"}'::jsonb);

-- -----------------------------------------------------------------------------
-- 1. The policy and the privilege exist.
-- -----------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename = 'audit_logs'
     and policyname = 'audit_logs_delete_super_admin'
     and cmd = 'DELETE';
  if v_count <> 1 then
    raise exception 'VALIDATION FAIL: audit_logs_delete_super_admin is missing';
  end if;

  if not has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') then
    raise exception 'VALIDATION FAIL: authenticated cannot attempt a DELETE on audit_logs';
  end if;

  raise notice 'PASS  the super-admin DELETE policy and privilege are present';
end
$$;

-- -----------------------------------------------------------------------------
-- 2. A non-super-admin deletes nothing.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $$
declare
  v_rows integer;
begin
  delete from public.audit_logs where action = 'validation_log';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'VALIDATION FAIL: a non-super-admin deleted % audit rows', v_rows;
  end if;
  raise notice 'PASS  a non-super-admin deletes no audit rows';
end
$$;
rollback;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.audit_logs
   where action = 'validation_log';
  if v_count <> 2 then
    raise exception 'VALIDATION FAIL: expected 2 surviving fixture rows, found %', v_count;
  end if;
  raise notice 'PASS  the refused DELETE left both fixture rows intact';
end
$$;

-- -----------------------------------------------------------------------------
-- 3. A super-admin deletes every fixture row.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$
declare
  v_rows integer;
begin
  delete from public.audit_logs where action = 'validation_log';
  get diagnostics v_rows = row_count;
  if v_rows <> 2 then
    raise exception 'VALIDATION FAIL: a super-admin deleted % rows, expected 2', v_rows;
  end if;
  raise notice 'PASS  a super-admin clears the audit rows';
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 4. Anon has no DELETE grant. Accept either a privilege error or zero rows;
--    both prove the anonymous browser key cannot clear the trail.
-- -----------------------------------------------------------------------------
begin;
set local role anon;
do $$
declare
  v_rows integer;
begin
  begin
    delete from public.audit_logs where action = 'validation_log';
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      raise exception 'VALIDATION FAIL: anon deleted % audit rows', v_rows;
    end if;
    raise notice 'PASS  anon deletes no audit rows';
  exception
    when insufficient_privilege then
      raise notice 'PASS  anon is refused DELETE on audit_logs';
  end;
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- Cleanup.
-- -----------------------------------------------------------------------------
delete from public.audit_logs where action = 'validation_log';
delete from public.profiles where id in (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002'
);
delete from auth.users where id in (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002'
);
