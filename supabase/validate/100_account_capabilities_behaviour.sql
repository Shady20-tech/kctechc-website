-- =============================================================================
-- Behavioural validation of the Phase 1 account capability and ownership model.
--
-- Run after the migrations, on the harness created by `00_supabase_shim.sql`.
--
-- This proves the three boundaries Phase 1 exists to establish, against a real
-- database rather than against the application:
--
--   1. Profile residency fields are constrained where they claim to be — a
--      Cameroon region is refused for a non-Cameroon resident, and a phone number
--      that is not a phone number is refused.
--
--   2. Capability is separate from authorization. A user may hold a landlord
--      membership, may hold an agent membership as well, and may not write
--      themselves an approved one. Crucially, `profiles.role` is unaffected by any
--      of it — the escalation guard from migration 24 is re-proven here so this
--      phase cannot have reopened it.
--
--   3. Ownership is enforced by RLS. One landlord cannot read or edit another
--      landlord's listing, and an agent cannot post for a different owner without
--      authorization evidence on file.
--
-- Every fixture is created and removed inside this file, so it can run against a
-- database that is otherwise untouched.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Fixtures.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-0000000000c1', 'p1-landlord-a@example.test'),
  ('f0000000-0000-0000-0000-0000000000c2', 'p1-landlord-b@example.test'),
  ('f0000000-0000-0000-0000-0000000000c3', 'p1-agent@example.test'),
  ('f0000000-0000-0000-0000-0000000000c4', 'p1-stranger@example.test'),
  ('f0000000-0000-0000-0000-0000000000c5', 'p1-re-admin@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, locale) values
  ('f0000000-0000-0000-0000-0000000000c1', 'p1-landlord-a@example.test', 'Landlord A', 'customer', 'en'),
  ('f0000000-0000-0000-0000-0000000000c2', 'p1-landlord-b@example.test', 'Landlord B', 'customer', 'en'),
  ('f0000000-0000-0000-0000-0000000000c3', 'p1-agent@example.test', 'Agent', 'customer', 'en'),
  ('f0000000-0000-0000-0000-0000000000c4', 'p1-stranger@example.test', 'Stranger', 'customer', 'en'),
  ('f0000000-0000-0000-0000-0000000000c5', 'p1-re-admin@example.test', 'RE Admin', 'real_estate_admin', 'en')
-- `handle_new_user` fires on the auth.users insert above and provisions each
-- profile as a bare `customer` with a null name, so the upsert must set the name
-- and role rather than the role alone.
on conflict (id) do update
  set full_name = excluded.full_name, role = excluded.role;

-- Landlord A and B are approved landlords; the agent is an approved agent. The
-- approvals are written as the service role, which is the only legitimate way to
-- reach `approved` (the RLS assertions below prove a user cannot do it).
insert into public.real_estate_memberships
  (user_id, membership_type, status, approved_by, approved_at)
values
  ('f0000000-0000-0000-0000-0000000000c1', 'landlord', 'approved',
   'f0000000-0000-0000-0000-0000000000c5', now()),
  ('f0000000-0000-0000-0000-0000000000c2', 'landlord', 'approved',
   'f0000000-0000-0000-0000-0000000000c5', now()),
  ('f0000000-0000-0000-0000-0000000000c3', 'agent', 'approved',
   'f0000000-0000-0000-0000-0000000000c5', now())
on conflict (user_id, membership_type) do update
  set status = 'approved', approved_by = excluded.approved_by,
      approved_at = excluded.approved_at, suspended_at = null,
      suspension_reason = null;

-- The agent needs an `agent_profiles` row to be the posting agent.
insert into public.agent_profiles (id, user_id, display_name, slug)
values (
  'f1000000-0000-0000-0000-0000000000d1',
  'f0000000-0000-0000-0000-0000000000c3',
  'Phase1 Agent', 'phase1-agent'
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 1. A user may hold BOTH capabilities, and holding one does not remove the
--    other. This is the brief's "a user may have either capability or both".
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from public.real_estate_memberships
    where user_id = 'f0000000-0000-0000-0000-0000000000c3'
      and membership_type = 'landlord'
  ) then
    -- The agent has no landlord row yet; add one to prove both can coexist.
    insert into public.real_estate_memberships
      (user_id, membership_type, status, approved_by, approved_at)
    values (
      'f0000000-0000-0000-0000-0000000000c3', 'landlord', 'approved',
      'f0000000-0000-0000-0000-0000000000c5', now()
    );
  end if;

  if (select count(*) from public.real_estate_memberships
      where user_id = 'f0000000-0000-0000-0000-0000000000c3') <> 2 then
    raise exception 'VALIDATION FAIL: a user could not hold both landlord and agent capabilities';
  end if;

  if not (public.user_has_membership('f0000000-0000-0000-0000-0000000000c3', 'landlord')
          and public.user_has_membership('f0000000-0000-0000-0000-0000000000c3', 'agent')) then
    raise exception 'VALIDATION FAIL: holding both capabilities did not resolve to both';
  end if;

  raise notice 'PASS  a user may hold landlord and agent capabilities at once';
end
$$;

-- -----------------------------------------------------------------------------
-- 2. A user may not create an already-approved membership for themselves.
--    The direct analogue of the role self-escalation guard.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c4', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.real_estate_memberships
      (user_id, membership_type, status, approved_by, approved_at)
    values (
      'f0000000-0000-0000-0000-0000000000c4', 'agent', 'approved',
      'f0000000-0000-0000-0000-0000000000c4', now()
    );
    raise exception 'VALIDATION FAIL: a user inserted an approved membership for themselves';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a user cannot self-approve a membership';
  end;
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 3. A user CAN apply for themselves, starting pending. This is the legitimate
--    path and must not have been closed by check 2.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c4', true);
set local role authenticated;
do $$
declare
  v_status public.membership_status;
begin
  insert into public.real_estate_memberships (user_id, membership_type, status)
  values ('f0000000-0000-0000-0000-0000000000c4', 'landlord', 'pending_review');

  select status into v_status from public.real_estate_memberships
  where user_id = 'f0000000-0000-0000-0000-0000000000c4' and membership_type = 'landlord';

  if v_status <> 'pending_review' then
    raise exception 'VALIDATION FAIL: the application did not persist (status %)', v_status;
  end if;
  raise notice 'PASS  a user may file their own membership application';
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 4. A user may not apply on behalf of another account.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c4', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.real_estate_memberships (user_id, membership_type, status)
    values ('f0000000-0000-0000-0000-0000000000c1', 'agent', 'pending_review');
    raise exception 'VALIDATION FAIL: a user applied for a capability on another account';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a user cannot apply for another account';
  end;
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 5. `profiles.role` is still not self-writable. This is the re-proof that Phase
--    1 has not reopened migration 24.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c4', true);
set local role authenticated;
do $$
declare
  v_rows integer;
begin
  begin
    update public.profiles set role = 'super_admin'
    where id = 'f0000000-0000-0000-0000-0000000000c4';
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      raise exception 'VALIDATION FAIL: a user escalated their own role';
    end if;
    raise notice 'PASS  role self-escalation remains blocked (no row changed)';
  exception
    when insufficient_privilege then
      raise notice 'PASS  role self-escalation remains blocked (refused)';
  end;
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 6. A non-Cameroon resident cannot claim a Cameroon region.
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    update public.profiles
    set country_of_residence = 'Ghana', country_iso_code = 'GH',
        region_id = (select id from public.regions limit 1)
    where id = 'f0000000-0000-0000-0000-0000000000c1';
    raise exception 'VALIDATION FAIL: a non-Cameroon resident was given a Cameroon region';
  exception
    when check_violation then
      raise notice 'PASS  a Cameroon region is refused for a non-Cameroon resident';
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- 7. A value that is not a phone number is refused by the format check.
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    update public.profiles set phone = 'not a phone'
    where id = 'f0000000-0000-0000-0000-0000000000c1';
    raise exception 'VALIDATION FAIL: a non-phone value was accepted';
  exception
    when check_violation then
      raise notice 'PASS  a non-phone value is refused by profiles_phone_format';
  end;

  -- An international number IS accepted, which is the point of the check.
  update public.profiles set phone = '+237 679-202-265'
  where id = 'f0000000-0000-0000-0000-0000000000c1';

  if (select phone from public.profiles where id = 'f0000000-0000-0000-0000-0000000000c1')
     <> '+237 679-202-265' then
    raise exception 'VALIDATION FAIL: an international phone number was not stored';
  end if;
  raise notice 'PASS  an international phone number is accepted';
end
$$;

-- -----------------------------------------------------------------------------
-- 8. Profile completion is derived, not trusted.
-- -----------------------------------------------------------------------------
do $$
declare
  v_completed timestamptz;
begin
  -- Landlord A now has a name, a phone, a country and a city, so is complete.
  update public.profiles set city = 'Limbe'
  where id = 'f0000000-0000-0000-0000-0000000000c1';
  select profile_completed_at into v_completed from public.profiles
  where id = 'f0000000-0000-0000-0000-0000000000c1';

  if v_completed is null then
    raise exception 'VALIDATION FAIL: a profile with name, phone, country and city is not marked complete';
  end if;

  -- Clearing the city makes it incomplete again.
  update public.profiles set city = null
  where id = 'f0000000-0000-0000-0000-0000000000c1';
  select profile_completed_at into v_completed from public.profiles
  where id = 'f0000000-0000-0000-0000-0000000000c1';

  if v_completed is not null then
    raise exception 'VALIDATION FAIL: an incomplete profile still reports as complete';
  end if;

  raise notice 'PASS  profile completion is derived from the columns';
end
$$;

-- -----------------------------------------------------------------------------
-- 9. Ownership: a landlord creates their own listing through RLS.
-- -----------------------------------------------------------------------------
do $$
declare
  v_region uuid;
  v_listing uuid;
begin
  select id into v_region from public.regions order by sort_order limit 1;
  if v_region is null then
    raise exception 'VALIDATION FAIL: no region exists to attach a listing to';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c1', true);

  insert into public.property_listings
    (slug, listing_type, property_kind, property_type, status, region_id,
     title, description, owner_id)
  values
    ('p1-validated-listing', 'sale', 'house', 'residential', 'draft', v_region,
     'Phase 1 validated listing',
     'A listing created by its approved landlord owner inside the validation.', 
     'f0000000-0000-0000-0000-0000000000c1')
  returning id into v_listing;

  reset role;

  if v_listing is null then
    raise exception 'VALIDATION FAIL: an approved landlord could not create a listing';
  end if;
  raise notice 'PASS  an approved landlord creates a listing they own';
end
$$;

-- -----------------------------------------------------------------------------
-- 10. A non-member cannot create a listing.
-- -----------------------------------------------------------------------------
do $$
declare
  v_region uuid;
begin
  select id into v_region from public.regions order by sort_order limit 1;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c4', true);
    insert into public.property_listings
      (slug, listing_type, property_kind, property_type, status, region_id,
       title, description, owner_id)
    values
      ('p1-stranger-listing', 'sale', 'house', 'residential', 'draft', v_region,
       'Should not exist', 'A listing a non-member must not be able to create.',
       'f0000000-0000-0000-0000-0000000000c4');
    raise exception 'VALIDATION FAIL: a non-member created a listing';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a user with no landlord capability cannot create a listing';
  end;
  reset role;
end
$$;

-- -----------------------------------------------------------------------------
-- 11. One landlord cannot read or edit another landlord's listing.
-- -----------------------------------------------------------------------------
do $$
declare
  v_listing uuid;
  v_rows integer;
begin
  select id into v_listing from public.property_listings
  where slug = 'p1-validated-listing';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c2', true);

  select count(*) into v_rows from public.property_listings where id = v_listing;
  if v_rows <> 0 then
    raise exception 'VALIDATION FAIL: landlord B read landlord A''s listing';
  end if;

  update public.property_listings set title = 'hijacked' where id = v_listing;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'VALIDATION FAIL: landlord B edited landlord A''s listing';
  end if;

  reset role;
  raise notice 'PASS  a landlord cannot read or edit another landlord''s listing';
end
$$;

-- -----------------------------------------------------------------------------
-- 12. An agent cannot PUBLISH a listing created for a different owner without
--     authorization evidence. A draft may exist while the mandate is being
--     collected; the gate is publication, which is where the authority matters.
--
-- The agent creates the listing themselves: `property_listings_insert_own_agent`
-- pins `agent_id` to the caller but does not constrain `owner_id`, which is
-- exactly the "agent lists on behalf of an owner" case this phase models.
-- -----------------------------------------------------------------------------
do $$
declare
  v_region uuid;
  v_listing uuid;
begin
  select id into v_region from public.regions order by sort_order limit 1;

  -- The agent files the listing for owner A, as a draft. Allowed: the mandate may
  -- not have been collected yet and the listing is not visible.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c3', true);
  insert into public.property_listings
    (slug, listing_type, property_kind, property_type, status, region_id,
     title, description, owner_id, agent_id)
  values
    ('p1-agent-own-listing', 'sale', 'house', 'residential', 'draft', v_region,
     'Agent listing for owner A',
     'A listing an agent created on behalf of a different owner.',
     'f0000000-0000-0000-0000-0000000000c1',
     'f1000000-0000-0000-0000-0000000000d1')
  returning id into v_listing;
  reset role;

  if v_listing is null then
    raise exception 'VALIDATION FAIL: an agent could not create a listing for an owner';
  end if;

  -- Publishing it without evidence must be refused.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c3', true);
    update public.property_listings set status = 'published' where id = v_listing;
    raise exception 'VALIDATION FAIL: an agent published for a different owner without authorization';
  exception
    when check_violation then
      raise notice 'PASS  an agent cannot publish for a different owner without authorization evidence';
  end;
  reset role;
end
$$;

-- -----------------------------------------------------------------------------
-- 13. With authorization evidence on file, the same publication is accepted.
-- -----------------------------------------------------------------------------
do $$
declare
  v_listing uuid;
begin
  select id into v_listing from public.property_listings
  where slug = 'p1-agent-own-listing';

  -- Record the authorization as the administrator (the only role that may).
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c5', true);
  insert into public.listing_owner_authorizations
    (listing_id, owner_user_id, agent_id, evidence_note, created_by)
  values (
    v_listing, 'f0000000-0000-0000-0000-0000000000c1',
    'f1000000-0000-0000-0000-0000000000d1',
    'Signed mandate received by email on file.',
    'f0000000-0000-0000-0000-0000000000c5'
  );
  reset role;

  -- Now publication is permitted.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c3', true);
  update public.property_listings set status = 'published' where id = v_listing;
  reset role;

  if (select status from public.property_listings where id = v_listing) <> 'published' then
    raise exception 'VALIDATION FAIL: an authorized agent relationship could not be published';
  end if;
  raise notice 'PASS  an authorized agent relationship may be published';
end
$$;

-- -----------------------------------------------------------------------------
-- 14. A non-agent cannot be recorded as the manager.
-- -----------------------------------------------------------------------------
do $$
declare
  v_listing uuid;
begin
  select id into v_listing from public.property_listings
  where slug = 'p1-validated-listing';

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000c1', true);
    update public.property_listings
    set managed_by = 'f0000000-0000-0000-0000-0000000000c4'
    where id = v_listing;
    raise exception 'VALIDATION FAIL: a non-agent was recorded as a manager';
  exception
    when check_violation then
      raise notice 'PASS  a non-agent cannot be recorded as a listing manager';
  end;
  reset role;
end
$$;

-- -----------------------------------------------------------------------------
-- Clean up every fixture this file created.
-- -----------------------------------------------------------------------------
delete from public.listing_owner_authorizations
where listing_id in (
  select id from public.property_listings where slug like 'p1-%'
);
delete from public.property_listings where slug like 'p1-%';
delete from public.agent_profiles where slug = 'phase1-agent';
delete from public.real_estate_memberships
where user_id in (
  'f0000000-0000-0000-0000-0000000000c1',
  'f0000000-0000-0000-0000-0000000000c2',
  'f0000000-0000-0000-0000-0000000000c3'
);
delete from public.profiles
where id in (
  'f0000000-0000-0000-0000-0000000000c1',
  'f0000000-0000-0000-0000-0000000000c2',
  'f0000000-0000-0000-0000-0000000000c3',
  'f0000000-0000-0000-0000-0000000000c4',
  'f0000000-0000-0000-0000-0000000000c5'
);
delete from auth.users
where id in (
  'f0000000-0000-0000-0000-0000000000c1',
  'f0000000-0000-0000-0000-0000000000c2',
  'f0000000-0000-0000-0000-0000000000c3',
  'f0000000-0000-0000-0000-0000000000c4',
  'f0000000-0000-0000-0000-0000000000c5'
);

select 'ALL PHASE 1 ACCOUNT CAPABILITY VALIDATIONS PASSED' as result;
