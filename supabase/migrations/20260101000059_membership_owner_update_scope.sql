-- =============================================================================
-- Close the membership self-service scope hole.
--
-- `20260101000057_real_estate_memberships.sql` declared `real_estate_memberships_update_own`
-- with a `using` clause of `user_id = auth.uid()` alone, and a comment that
-- claimed the owner could "withdraw an application or resubmit one that was sent
-- back — and nothing else".
--
-- The `with check` half enforced the *destination* (`status in ('pending_kyc',
-- 'pending_review')`), but nothing constrained the *source*. RLS `using` decides
-- which rows the owner may target, and it admitted every state. So an owner could
-- target their own row in ANY state and move it to `pending_review`:
--
--   * an APPROVED membership could be reset to `pending_review`, revoking a live
--     capability the holder had been granted. The `already_member` branch in
--     `applyForMembershipAction` — which the action's comment says the update
--     policy produces — was therefore dead code, and the capability self-reset
--     was the direct analogue of the role escalation migration 24 closed.
--
--   * a SUSPENDED membership could be reset to `pending_review`, clearing
--     `suspended_at` and `suspension_reason` and undoing a staff decision. A
--     suspension is a decision made *about* the member; the member must not be
--     able to lift it by re-submitting the application form.
--
-- Both were reproduced against the harness: as `authenticated` with the row's own
-- `sub` claim, an `update … set status = 'pending_review'` on an approved row, and
-- on a suspended row, both succeeded.
--
-- The fix narrows the `using` clause to the states the owner is actually entitled
-- to act on — the pending states they may edit or withdraw, plus the two decided
-- states they may answer by re-applying. That is exactly
-- `APPLICANT_SETTABLE_STATUSES ∪ REAPPLICABLE_MEMBERSHIP_STATUSES` in
-- `src/lib/real-estate/memberships.ts`, and the mirror test keeps the two in step.
--
-- `approved` and `suspended` are reachable only through
-- `real_estate_memberships_write_staff`, which is unchanged.
--
-- No function is created here, so the Phase 12 EXECUTE allow-list is unaffected.
-- =============================================================================

drop policy if exists "real_estate_memberships_update_own"
  on public.real_estate_memberships;

-- A user may withdraw or resubmit an application they are entitled to answer —
-- and nothing else. The `using` clause is the source-state guard; the `with check`
-- holds the row to the pending states, so an update can never move a membership
-- into `approved`.
create policy "real_estate_memberships_update_own"
  on public.real_estate_memberships for update
  to authenticated
  using (
    user_id = auth.uid()
    and status in (
      'pending_kyc',
      'pending_review',
      'rejected',
      'changes_requested'
    )
  )
  with check (
    user_id = auth.uid()
    and status in ('pending_kyc', 'pending_review')
    and approved_by is null
    and approved_at is null
  );

-- -----------------------------------------------------------------------------
-- Assert the outcome.
--
-- The property: an owner may re-apply from a decided state they were asked to
-- answer, but may NOT reset an approved capability or lift a staff suspension.
-- Proven against the database, because the application cannot demonstrate an RLS
-- boundary — the action's own guard is a message, not the control.
-- -----------------------------------------------------------------------------
do $$
declare
  v_user uuid := 'a0000000-0000-0000-0000-0000000000c9';
  v_reviewer uuid := 'a0000000-0000-0000-0000-0000000000c8';
  v_rows integer;
  v_status public.membership_status;
begin
  insert into auth.users (id, email) values
    (v_user, 'membership-scope@example.test'),
    (v_reviewer, 'membership-scope-reviewer@example.test')
  on conflict (id) do nothing;

  -- An approved membership, written as the service role (the only legitimate
  -- route to `approved`).
  insert into public.real_estate_memberships
    (user_id, membership_type, status, approved_by, approved_at)
  values
    (v_user, 'landlord', 'approved', v_reviewer, now())
  on conflict (user_id, membership_type) do update
    set status = 'approved', approved_by = excluded.approved_by,
        approved_at = excluded.approved_at,
        suspended_at = null, suspension_reason = null;

  -- (a) The owner may NOT reset an approved membership.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_user::text, true);

    update public.real_estate_memberships
      set status = 'pending_review', approved_by = null, approved_at = null
      where user_id = v_user and membership_type = 'landlord';
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then
      v_rows := 0; -- refused by the policy, which is the expected outcome
  end;
  reset role;

  select status into v_status
  from public.real_estate_memberships
  where user_id = v_user and membership_type = 'landlord';

  if v_status <> 'approved' then
    raise exception
      'Membership scope FAILED: an owner reset an approved membership (status %)',
      v_status;
  end if;

  -- (b) A suspended membership may NOT be lifted by its owner.
  update public.real_estate_memberships
    set status = 'suspended', suspended_at = now(),
        suspension_reason = 'policy breach'
    where user_id = v_user and membership_type = 'landlord';

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_user::text, true);

    update public.real_estate_memberships
      set status = 'pending_review', suspended_at = null,
          suspension_reason = null, approved_by = null, approved_at = null
      where user_id = v_user and membership_type = 'landlord';
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then
      v_rows := 0;
  end;
  reset role;

  select status into v_status
  from public.real_estate_memberships
  where user_id = v_user and membership_type = 'landlord';

  if v_status <> 'suspended' then
    raise exception
      'Membership scope FAILED: an owner lifted a staff suspension (status %)',
      v_status;
  end if;

  -- (c) The legitimate path still works: a refused application may be re-applied.
  update public.real_estate_memberships
    set status = 'rejected', review_notes = 'missing document',
        approved_by = null, approved_at = null,
        suspended_at = null, suspension_reason = null
    where user_id = v_user and membership_type = 'landlord';

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_user::text, true);

    update public.real_estate_memberships
      set status = 'pending_review', review_notes = null
      where user_id = v_user and membership_type = 'landlord';
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then
      raise exception
        'Membership scope FAILED: a rejected application could not be re-applied';
  end;
  reset role;

  select status into v_status
  from public.real_estate_memberships
  where user_id = v_user and membership_type = 'landlord';

  if v_status <> 'pending_review' then
    raise exception
      'Membership scope FAILED: the re-application did not persist (status %)',
      v_status;
  end if;

  -- Clean up, so a migration applied to a live database leaves nothing behind.
  delete from public.real_estate_memberships where user_id = v_user;
  delete from public.profiles where id in (v_user, v_reviewer);
  delete from auth.users where id in (v_user, v_reviewer);

  raise notice 'Membership scope: owner may re-apply, may not reset a capability or a suspension';
end
$$;
