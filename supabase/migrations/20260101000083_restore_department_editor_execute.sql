-- =============================================================================
-- Restore the browser grant on `is_department_editor(text)`.
--
-- The predicate is called from RLS policies on products, categories, insights,
-- projects and project media. PostgreSQL checks EXECUTE for a function used in a
-- policy, so a browser role without this grant gets
--
--   permission denied for function is_department_editor (42501)
--
-- before any row is returned. The store console surfaced it first as "Product
-- categories could not be loaded"; the same failure would reach every
-- department-authored store and content read.
--
-- Migration 42 granted this when it created the function, but the grant is not
-- present on the hosted project. The most likely cause is the Phase 12
-- default-deny migration being re-run after 42 (it revokes from `anon` and
-- `authenticated` by name). A grant that depends on the order in which two
-- already-applied migrations were replayed is not durable, so this migration
-- states the final ACL explicitly and asserts it in the same transaction.
-- =============================================================================

revoke all on function public.is_department_editor(text) from public;
revoke all on function public.is_department_editor(text) from anon;
revoke all on function public.is_department_editor(text) from authenticated;
revoke all on function public.is_department_editor(text) from service_role;

grant execute on function public.is_department_editor(text) to anon, authenticated, service_role;

do $$
begin
  if not has_function_privilege('anon', 'public.is_department_editor(text)', 'EXECUTE') then
    raise exception
      'VALIDATION FAIL: anon cannot execute is_department_editor (public policies would fail)';
  end if;

  if not has_function_privilege('authenticated', 'public.is_department_editor(text)', 'EXECUTE') then
    raise exception
      'VALIDATION FAIL: authenticated cannot execute is_department_editor (console reads and writes would fail)';
  end if;

  if not has_function_privilege('service_role', 'public.is_department_editor(text)', 'EXECUTE') then
    raise exception
      'VALIDATION FAIL: service_role cannot execute is_department_editor';
  end if;

  raise notice 'PASS  is_department_editor is executable by the roles its policies run as';
end;
$$;
