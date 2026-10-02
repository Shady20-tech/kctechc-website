-- =============================================================================
-- Phase 12 — Function EXECUTE hardening.
--
-- Supabase grants `EXECUTE` on new functions in `public` to `anon`,
-- `authenticated` and `service_role` by default. A `SECURITY DEFINER` function
-- is the dangerous case: it runs as its owner, so a default grant turns it into
-- an RPC any visitor can call with RLS fully bypassed. Most of the functions in
-- this schema are `SECURITY DEFINER`.
--
-- That default is what the earlier phases relied on, and it is wrong for
-- everything that is not a deliberate public read. The concrete consequences,
-- reproduced against a clean database before this migration:
--
--   * `apply_payment_result` was callable by `anon` and `authenticated`. A
--     signed-in customer could read their own payment id through the legitimate
--     `payments_select_own` policy and then call the function directly to mark
--     their own order `paid` with no money received. `anon` could do the same
--     with any payment id, and could read the existence of a row from the
--     function's own "Payment not found" error.
--   * `cancel_order` was callable by `anon`, letting an unauthenticated visitor
--     cancel any order whose id they held and release its reserved inventory.
--   * `import_administrative_divisions` was callable by `anon`, an
--     unauthenticated write into the geography tables.
--   * `requeue_translation_entry` was granted to `authenticated`, so any signed-in
--     user could mutate the translation queue.
--   * `review_listing_submission` — which publishes a listing — was callable by
--     `anon` and had no internal role check at all. The corrected migration
--     keeps it reachable by `authenticated` (the application calls it with the
--     session client) but adds the `is_real_estate_admin()` guard it never had.
--
-- =============================================================================
-- Why the first revision of this migration did not work
-- =============================================================================
--
-- The first revision revoked `EXECUTE` from `PUBLIC` only, on the assumption
-- that Supabase's automatic grant lands in the `PUBLIC` group. It does not.
-- Supabase grants to `anon`, `authenticated` and `service_role` **by name**, as
-- separate ACL entries, and `REVOKE ... FROM PUBLIC` removes only the `=X`
-- entry — the `anon=X` and `authenticated=X` entries survive. The migration
-- therefore passed its own assertion (which only checked the named privileged
-- functions, not the rest of the schema) while leaving every privileged RPC
-- reachable from a browser key.
--
-- Supabase's own documentation says exactly this: to restrict a function you
-- "revoke execute ... from both `public` and the role you're restricting". The
-- corrected migration below revokes from `anon` and `authenticated` explicitly.
--
-- The rule this migration applies:
--
--   1. `REVOKE ALL ... FROM PUBLIC` on every function in `public`, for
--      completeness and to remove the group default.
--   2. `REVOKE ALL ... FROM anon, authenticated` on every function in `public`.
--      This is the step that actually removes Supabase's per-role default.
--   3. Re-grant `EXECUTE` to `service_role` only. The service-role key is
--      server-only (see `src/lib/supabase/admin.ts`), so this restores exactly
--      the callers that are trusted.
--   4. Re-grant the deliberate browser-callable functions — and only those — to
--      `anon`/`authenticated`. Three kinds qualify:
--        * the public RPCs whose entire purpose is to be called by the browser;
--        * the role predicates that RLS policies evaluate (a policy runs as the
--          requesting role, so revoking these makes the affected tables
--          unreadable);
--        * the helper functions referenced by CHECK constraints and column
--          defaults on tables the browser may write (Postgres does check
--          `EXECUTE` for these).
--   5. Assert the outcome. The assertion is a *subset* check: any non-trigger
--      function in `public` that `anon` or `authenticated` can execute must be
--      on the allow-list. A new function therefore fails this migration unless
--      it is classified here, which is what keeps the default-deny policy true
--      for functions added after this migration was written.
--
-- Trigger functions need no browser grant: Postgres does not check `EXECUTE` on
-- the trigger function when a trigger fires, so they are revoked along with
-- everything else and simply never re-granted.
--
-- Replacing a function with `create or replace` preserves its ACL, so the grants
-- here survive a later redefinition. A *new* function, however, gets the default
-- grant again — the assertion in step 6 is what catches that.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Remove the group default from every function in `public`.
--
-- Enumerated from the catalogue rather than listed by hand so a function added
-- since this migration was written cannot keep the default by omission.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public', v_fn.signature);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Remove Supabase's per-role default grant.
--
-- This is the load-bearing step. Supabase grants `EXECUTE` to `anon`,
-- `authenticated` and `service_role` as named ACL entries, so revoking from
-- `PUBLIC` alone leaves the browser roles able to call every function.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format(
      'revoke all on function %s from anon, authenticated',
      v_fn.signature
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. The trusted server-side caller.
--
-- `service_role` is the server-only key. Re-granting to it restores application
-- reads, writes and every trigger that fires on a service-role connection.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('grant execute on function %s to service_role', v_fn.signature);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. The deliberate browser-callable functions.
--
-- Every name here is reachable by `anon` and `authenticated` after this
-- migration, and nothing else is.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn record;
  v_public text[] := array[
    -- Public RPCs: called through the publishable key, each enforcing its own
    -- visibility predicate internally.
    'place_order',                  -- guest checkout; computes every total itself
    'search_property_listings',     -- pins status to the public set, narrows only
    'listing_geography_counts',     -- same predicate, counts only
    'match_region_by_name',         -- name-to-region lookup for the search box
    'record_listing_view',          -- public view counter; published-only, de-duped
    -- Role predicates evaluated inside RLS policies. A policy runs as the
    -- requesting role, so these must be executable by that role or the table
    -- becomes unreadable.
    'is_admin',
    'is_super_admin',
    'is_real_estate_admin',
    'is_inquiry_manager',
    'current_user_role',
    'current_agent_id',
    'can_access_department',
    'inquiry_is_for_agent_listing', -- used by two agent-listing SELECT policies
    -- Helper functions referenced by CHECK constraints, column defaults and
    -- stored generated columns on tables the browser writes. Postgres checks
    -- EXECUTE for all three, and the failure only appears on the write.
    'gtin_is_valid',                -- products_gtin_valid CHECK
    'generate_listing_reference',   -- property_listings.reference default
    'publish_state_is_consistent',  -- property_listings published_requires_at CHECK
    'immutable_array_to_string'     -- property_listings.search_vector generated column
  ];
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (v_public)
  loop
    execute format('grant execute on function %s to anon, authenticated', v_fn.signature);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Functions an authenticated user needs, but only through a checked path.
--
-- `set_listing_private_details` and `set_listing_localized_slug` are `security
-- invoker`, so the RLS policies on `listing_private_details` and `listing_slugs`
-- remain the control (own listing for an agent, any listing for a real-estate
-- administrator); the functions only exist to make a partial update expressible.
-- The admin Server Action that calls them also checks the role first, but the
-- database is the control.
--
-- `review_listing_submission` is the harder case. It is `security definer`, so
-- RLS on the tables it writes is bypassed and the grant would be the only
-- control — and it had no internal role check, so granting it to `authenticated`
-- as-is would let any signed-in user publish any listing. The application calls
-- it with the *session* client (not the service-role client) so `auth.uid()`
-- attributes the reviewer, which means it does need to be reachable by
-- `authenticated`. It is therefore redefined below with an internal
-- `is_real_estate_admin()` guard, which is the same predicate the
-- `listing_submissions_write_admin` policy already uses and the same role set
-- `REAL_ESTATE_ADMIN_ROLES` holds in `src/lib/auth/roles.ts`.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('set_listing_private_details', 'set_listing_localized_slug')
  loop
    execute format('grant execute on function %s to authenticated', v_fn.signature);
  end loop;
end;
$$;

create or replace function public.review_listing_submission(
  p_submission_id uuid,
  p_decision public.submission_status,
  p_review_notes text default null,
  p_publish boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.listing_submissions;
  v_listing public.property_listings;
begin
  -- The function is `security definer`, so this guard is the access control for
  -- the tables it writes. Without it the only check was in the Server Action,
  -- which a direct PostgREST call does not run.
  if not public.is_real_estate_admin() then
    raise exception 'Only a real estate administrator may review a submission'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_submission
  from public.listing_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Unknown submission %', p_submission_id
      using errcode = 'no_data_found';
  end if;

  if v_submission.status <> 'pending_review' then
    raise exception 'Submission % has already been decided (%)',
      p_submission_id, v_submission.status
      using errcode = 'check_violation';
  end if;

  if p_decision = 'pending_review' then
    raise exception 'A review must reach a decision'
      using errcode = 'check_violation';
  end if;

  update public.listing_submissions
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = p_review_notes
  where id = p_submission_id;

  select * into v_listing
  from public.property_listings
  where id = v_submission.listing_id
  for update;

  -- Publishing is attempted only after the approval row is written, because the
  -- lifecycle trigger reads that row to decide whether publication is permitted.
  if p_publish and p_decision = 'approved' and v_listing.status = 'draft' then
    update public.property_listings
    set status = 'published'
    where id = v_listing.id;
  end if;

  -- A refusal or a request for changes returns the listing to draft so it leaves
  -- the review queue and cannot linger in a state that implies it is being
  -- considered.
  if p_decision in ('rejected', 'changes_requested')
     and v_listing.status = 'pending_review' then
    update public.property_listings
    set status = 'draft'
    where id = v_listing.id;
  end if;
end;
$$;

do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'review_listing_submission'
  loop
    execute format('grant execute on function %s to authenticated', v_fn.signature);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Assert the outcome.
--
-- A hardening migration that silently failed to revoke is worse than none,
-- because the comment above would then be a false assurance. Two checks:
--
--   (a) the named privileged functions are not executable by a browser key;
--   (b) *no* non-trigger function outside the allow-list is, which is what makes
--       this a default-deny policy rather than a deny-list.
-- -----------------------------------------------------------------------------
do $$
declare
  v_leak text;
  v_allowed text[] := array[
    'place_order', 'search_property_listings', 'listing_geography_counts',
    'match_region_by_name', 'record_listing_view',
    'is_admin', 'is_super_admin', 'is_real_estate_admin', 'is_inquiry_manager',
    'current_user_role', 'current_agent_id', 'can_access_department',
    'inquiry_is_for_agent_listing',
    'gtin_is_valid', 'generate_listing_reference', 'publish_state_is_consistent',
    'immutable_array_to_string',
    'set_listing_private_details', 'set_listing_localized_slug',
    'review_listing_submission'
  ];
begin
  -- (a) The functions that must never be reachable from a browser key.
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
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if v_leak is not null then
    raise exception 'Privileged functions still executable by a browser key: %', v_leak;
  end if;

  -- (b) Anything else reachable by a browser key must be classified above.
  select string_agg(p.oid::regprocedure::text, ', ')
  into v_leak
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prorettype <> 'trigger'::regtype
    and p.proname <> all (v_allowed)
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if v_leak is not null then
    raise exception
      'Unclassified function(s) executable by a browser key: % (add to the allow-list or revoke)', v_leak;
  end if;
end;
$$;
