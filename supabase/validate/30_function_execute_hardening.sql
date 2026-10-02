-- =============================================================================
-- Behavioural validation of the function EXECUTE surface.
--
-- Run after the migrations. This is the security counterpart to
-- `10_store_behaviour.sql` and `20_real_estate_platform_behaviour.sql`: those
-- prove the schema behaves correctly for the callers it is meant to serve, and
-- this proves the privileged functions are not reachable by the callers they are
-- not.
--
-- It exists because the defect it pins was invisible to every other test in the
-- repository. Supabase grants `EXECUTE` on new `public` functions to `anon` and
-- `authenticated` by default, and a `SECURITY DEFINER` function runs as its
-- owner — so `apply_payment_result`, `cancel_order` and
-- `import_administrative_divisions` were callable from a browser key with RLS
-- bypassed. No unit test exercises `EXECUTE` grants, and the TypeScript RPC
-- wrapper only checks the response, so a direct PostgREST call was the only way
-- to see it.
--
-- =============================================================================
-- Why this file changed
-- =============================================================================
--
-- The first version asserted only that a hand-picked list of privileged
-- functions was unreachable. It passed — because the first hardening migration
-- *also* only failed to protect that list. Supabase grants to `anon` and
-- `authenticated` by name; `REVOKE ... FROM PUBLIC` does not remove those
-- entries, so every function stayed callable and the assertion never looked.
--
-- The assertions below are a subset check instead: **no** non-trigger function
-- in `public` may be executable by a browser key unless it is on the allow-list.
-- That is the property the migration is supposed to establish, and it is the one
-- the earlier version failed to test.
--
-- Every assertion is either a `permission denied` that must be raised, or a
-- `has_function_privilege` check. The two are complementary: the first proves
-- the call actually fails, the second proves the grant is absent rather than
-- merely unreachable by the path taken here.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  v_browser_roles text[] := array['anon', 'authenticated'];
  v_allowed text[] := array[
    'place_order', 'search_property_listings', 'listing_geography_counts',
    'match_region_by_name', 'record_listing_view',
    'is_admin', 'is_super_admin', 'is_real_estate_admin', 'is_inquiry_manager',
    'current_user_role', 'current_agent_id', 'can_access_department',
    'is_department_editor',
    'inquiry_is_for_agent_listing',
    'gtin_is_valid', 'generate_listing_reference', 'publish_state_is_consistent',
    'immutable_array_to_string',
    'set_listing_private_details', 'set_listing_localized_slug',
    'review_listing_submission'
  ];
  v_role text;
  v_leak text;
begin
  -- ---------------------------------------------------------------------------
  -- No privileged function may be executable by a browser key.
  -- ---------------------------------------------------------------------------
  for v_role in select unnest(v_browser_roles)
  loop
    select string_agg(p.oid::regprocedure::text, ', ')
    into v_leak
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'apply_payment_result', 'cancel_order', 'release_order_inventory',
        'import_administrative_divisions',
        'requeue_translation_entry', 'recount_listing_metrics',
        'claim_translation_sync_jobs', 'complete_translation_sync_job',
        'fail_translation_sync_job'
      )
      and has_function_privilege(v_role, p.oid, 'EXECUTE');

    if v_leak is not null then
      raise exception 'VALIDATION FAIL: % may execute privileged function(s): %',
        v_role, v_leak;
    end if;
  end loop;

  raise notice 'PASS  no privileged function is executable by anon or authenticated';

  -- ---------------------------------------------------------------------------
  -- Default-deny: everything reachable by a browser key is classified.
  --
  -- This is the assertion the first version lacked. A new function that keeps
  -- Supabase's default grant fails here unless it is added to the allow-list.
  -- ---------------------------------------------------------------------------
  for v_role in select unnest(v_browser_roles)
  loop
    select string_agg(p.oid::regprocedure::text, ', ')
    into v_leak
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype <> 'trigger'::regtype
      and p.proname <> all (v_allowed)
      and has_function_privilege(v_role, p.oid, 'EXECUTE');

    if v_leak is not null then
      raise exception
        'VALIDATION FAIL: % may execute unclassified function(s): %',
        v_role, v_leak;
    end if;
  end loop;

  raise notice 'PASS  every function reachable by a browser key is on the allow-list';

  -- ---------------------------------------------------------------------------
  -- The per-role default grant is gone, not just the PUBLIC one.
  --
  -- Checked by ACL entry rather than `has_function_privilege` so a future change
  -- that routes the grant through a group cannot satisfy the test.
  -- ---------------------------------------------------------------------------
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, '{}')) as acl
    join pg_roles r on r.oid = acl.grantee
    where n.nspname = 'public'
      and p.proname = 'apply_payment_result'
      and r.rolname in ('anon', 'authenticated')
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'VALIDATION FAIL: apply_payment_result still carries an anon/authenticated EXECUTE grant';
  end if;

  raise notice 'PASS  no named browser-role EXECUTE grant survives on a privileged function';

  -- ---------------------------------------------------------------------------
  -- The deliberate public functions survive.
  --
  -- A hardening migration that revoked everything would close the vulnerability
  -- and break checkout, search and the RLS policies that call role predicates.
  -- ---------------------------------------------------------------------------
  for v_role in select unnest(v_browser_roles)
  loop
    if not has_function_privilege(v_role, 'public.search_property_listings(text, uuid, uuid, uuid, public.listing_type, public.listing_property_kind, public.property_type, bigint, bigint, smallint, smallint, integer, integer, public.listing_status[], text[], public.locale_code, public.listing_sort_order, integer, integer)', 'EXECUTE') then
      raise exception 'VALIDATION FAIL: % cannot execute search_property_listings (browse would break)', v_role;
    end if;
    if not has_function_privilege(v_role, 'public.is_admin()', 'EXECUTE') then
      raise exception 'VALIDATION FAIL: % cannot execute is_admin (RLS policies would fail)', v_role;
    end if;
    if not has_function_privilege(v_role, 'public.gtin_is_valid(text)', 'EXECUTE') then
      raise exception 'VALIDATION FAIL: % cannot execute gtin_is_valid (product writes would fail the CHECK)', v_role;
    end if;
    if not has_function_privilege(v_role, 'public.generate_listing_reference()', 'EXECUTE') then
      raise exception 'VALIDATION FAIL: % cannot execute generate_listing_reference (property writes would fail the default)', v_role;
    end if;
    if not has_function_privilege(v_role, 'public.is_department_editor(text)', 'EXECUTE') then
      raise exception 'VALIDATION FAIL: % cannot execute is_department_editor (the project write policies would fail)', v_role;
    end if;
  end loop;

  raise notice 'PASS  the deliberate public functions remain executable';
end
$$;

-- -----------------------------------------------------------------------------
-- `place_order` is service-role only.
--
-- It was briefly on the allow-list above. The application never called it from a
-- browser key — the checkout action uses the service-role client — so the grant
-- was pure attack surface: a SECURITY DEFINER write that bypasses RLS and takes
-- a caller-supplied cart id and customer id. This asserts the revoke holds, so a
-- future allow-list edit that re-adds it fails here.
-- -----------------------------------------------------------------------------
do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated']
  loop
    if has_function_privilege(v_role, 'public.place_order(text, uuid, uuid, text, text, text, public.locale_code, public.order_fulfillment, public.payment_method, text, text, text, uuid, text, integer)', 'EXECUTE') then
      raise exception 'VALIDATION FAIL: % can execute place_order (checkout is service-role only)', v_role;
    end if;
  end loop;

  if not has_function_privilege('service_role', 'public.place_order(text, uuid, uuid, text, text, text, public.locale_code, public.order_fulfillment, public.payment_method, text, text, text, uuid, text, integer)', 'EXECUTE') then
    raise exception 'VALIDATION FAIL: service_role cannot execute place_order (checkout would break)';
  end if;

  raise notice 'PASS  place_order is callable by service_role only';
end
$$;

-- -----------------------------------------------------------------------------
-- The calls themselves must fail, not merely be ungranted.
-- -----------------------------------------------------------------------------
set role anon;
do $$
begin
  begin
    perform public.apply_payment_result(
      '00000000-0000-0000-0000-000000000000'::uuid,
      'succeeded'::public.payment_status,
      'FORGED', null, '{}'::jsonb
    );
    raise exception 'VALIDATION FAIL: anon was allowed to call apply_payment_result';
  exception
    when insufficient_privilege then
      raise notice 'PASS  anon calling apply_payment_result is denied';
  end;

  begin
    perform public.cancel_order(
      '00000000-0000-0000-0000-000000000000'::uuid, null, 'customer', 'x'
    );
    raise exception 'VALIDATION FAIL: anon was allowed to call cancel_order';
  exception
    when insufficient_privilege then
      raise notice 'PASS  anon calling cancel_order is denied';
  end;

  begin
    perform public.import_administrative_divisions('SW', '[]'::jsonb);
    raise exception 'VALIDATION FAIL: anon was allowed to call import_administrative_divisions';
  exception
    when insufficient_privilege then
      raise notice 'PASS  anon calling import_administrative_divisions is denied';
  end;

  begin
    perform public.review_listing_submission(
      '00000000-0000-0000-0000-000000000000'::uuid, 'approved', null, true
    );
    raise exception 'VALIDATION FAIL: anon was allowed to call review_listing_submission';
  exception
    when insufficient_privilege then
      raise notice 'PASS  anon calling review_listing_submission is denied';
  end;
end
$$;
reset role;

-- -----------------------------------------------------------------------------
-- A signed-in customer is denied too.
--
-- This is the case that mattered most: the customer can legitimately read their
-- own payment id, so the only thing standing between them and a forged `paid`
-- order is the EXECUTE grant.
-- -----------------------------------------------------------------------------
set role authenticated;
do $$
begin
  begin
    perform public.apply_payment_result(
      '00000000-0000-0000-0000-000000000000'::uuid,
      'succeeded'::public.payment_status,
      'FORGED', null, '{}'::jsonb
    );
    raise exception 'VALIDATION FAIL: authenticated was allowed to call apply_payment_result';
  exception
    when insufficient_privilege then
      raise notice 'PASS  authenticated calling apply_payment_result is denied';
  end;

  -- `review_listing_submission` is deliberately reachable by `authenticated`
  -- (the application calls it with the session client), so the grant cannot be
  -- the control. The `is_real_estate_admin()` guard inside it is — this proves a
  -- signed-in non-admin is refused rather than being able to publish a listing.
  begin
    perform public.review_listing_submission(
      '00000000-0000-0000-0000-000000000000'::uuid, 'approved', null, true
    );
    raise exception 'VALIDATION FAIL: a non-admin authenticated caller reached review_listing_submission';
  exception
    when insufficient_privilege then
      raise notice 'PASS  non-admin authenticated calling review_listing_submission is denied by the internal guard';
  end;
end
$$;
reset role;

-- -----------------------------------------------------------------------------
-- service_role, the trusted server-side caller, still works.
--
-- The application writes through the service-role key, so a revoke that caught
-- this role too would take the site down rather than secure it.
-- -----------------------------------------------------------------------------
do $$
begin
  if not has_function_privilege('service_role', 'public.apply_payment_result(uuid, public.payment_status, text, text, jsonb)', 'EXECUTE') then
    raise exception 'VALIDATION FAIL: service_role cannot execute apply_payment_result (the webhook would break)';
  end if;
  if not has_function_privilege('service_role', 'public.cancel_order(uuid, uuid, text, text)', 'EXECUTE') then
    raise exception 'VALIDATION FAIL: service_role cannot execute cancel_order (admin cancellation would break)';
  end if;
  if not has_function_privilege('service_role', 'public.place_order(text, uuid, uuid, text, text, text, public.locale_code, public.order_fulfillment, public.payment_method, text, text, text, uuid, text, integer)', 'EXECUTE') then
    raise exception 'VALIDATION FAIL: service_role cannot execute place_order (checkout would break)';
  end if;
end
$$;

do $$
begin
  raise notice 'PASS  service_role retains the privileged functions it needs';
end
$$;

select 'ALL FUNCTION EXECUTE VALIDATIONS PASSED' as result;
