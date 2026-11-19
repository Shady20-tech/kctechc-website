-- =============================================================================
-- Behavioural validation of the publisher-verification badge.
--
-- Run after the migrations, on the harness created by `00_supabase_shim.sql`.
--
-- This proves the rule the brief states most firmly about the badge — it is a
-- deliberate trust mark, never inferred from an approval — against a real
-- database rather than against the application:
--
--   1. An approved capability alone does NOT verify a publisher. A listing whose
--      owner holds an approved but unverified membership carries
--      `publisher_verified = false`.
--
--   2. Granting the badge is a super-admin act. A real-estate administrator — who
--      may manage listings — is refused by the trigger (`42501`), and a super
--      admin is accepted. This is the boundary, not the Server Action's guard.
--
--   3. The badge is denormalized onto the listing and kept in step: a grant, a
--      revocation, and a suspension all reach the listings the poster holds, with
--      no application code involved.
--
--   4. The poster of a listing is its agent's user when an agent manages it, and
--      its owner otherwise, so an agent-managed listing takes the agent's badge.
--
-- Every fixture is created and removed inside this file.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Fixtures. Written as the service role (the trusted context: `auth.uid()` is
-- null), which is the only way a membership reaches `approved` and the only way a
-- badge can be granted without a super-admin session.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('f1200000-0000-0000-0000-0000000000a1', 'p4-landlord@example.test'),
  ('f1200000-0000-0000-0000-0000000000a2', 'p4-agent@example.test'),
  ('f1200000-0000-0000-0000-0000000000a3', 'p4-super@example.test'),
  ('f1200000-0000-0000-0000-0000000000a4', 'p4-re-admin@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, locale) values
  ('f1200000-0000-0000-0000-0000000000a1', 'p4-landlord@example.test', 'Landlord', 'customer', 'en'),
  ('f1200000-0000-0000-0000-0000000000a2', 'p4-agent@example.test', 'Agent', 'real_estate_agent', 'en'),
  ('f1200000-0000-0000-0000-0000000000a3', 'p4-super@example.test', 'Super Admin', 'super_admin', 'en'),
  ('f1200000-0000-0000-0000-0000000000a4', 'p4-re-admin@example.test', 'RE Admin', 'real_estate_admin', 'en')
on conflict (id) do update
  set full_name = excluded.full_name, role = excluded.role;

insert into public.agent_profiles (id, user_id, display_name, slug) values
  ('f1200000-0000-0000-0000-0000000000b1', 'f1200000-0000-0000-0000-0000000000a2', 'Agent', 'p4-agent')
on conflict (id) do nothing;

-- Both capabilities are approved. Neither is verified yet.
insert into public.real_estate_memberships
  (id, user_id, membership_type, status, approved_by, approved_at)
values
  ('f1200000-0000-0000-0000-0000000000d1', 'f1200000-0000-0000-0000-0000000000a1', 'landlord', 'approved',
   'f1200000-0000-0000-0000-0000000000a3', now()),
  ('f1200000-0000-0000-0000-0000000000d2', 'f1200000-0000-0000-0000-0000000000a2', 'agent', 'approved',
   'f1200000-0000-0000-0000-0000000000a3', now())
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 1. An approved but unverified owner does not verify their listing.
-- -----------------------------------------------------------------------------
do $$
declare
  v_region uuid;
  v_listing uuid;
  v_verified boolean;
begin
  select id into v_region from public.regions order by sort_order limit 1;
  if v_region is null then
    raise exception 'VALIDATION FAIL: no region seeded';
  end if;

  insert into public.property_listings
    (slug, listing_type, property_kind, property_type, status, region_id,
     title, description, owner_id)
  values
    ('p4-landlord-listing', 'sale', 'house', 'residential', 'draft', v_region,
     'Phase 4 verification listing',
     'A listing owned by an approved but unverified landlord.',
     'f1200000-0000-0000-0000-0000000000a1')
  returning id, publisher_verified into v_listing, v_verified;

  if v_verified then
    raise exception 'VALIDATION FAIL: an approved but unverified owner verified their listing';
  end if;
  raise notice 'PASS  an approved but unverified publisher is not verified';

  -- Grant the badge as the service role, then confirm the AFTER trigger reached
  -- the listing with no application code involved.
  update public.real_estate_memberships
    set verified_at = now(), verified_by = 'f1200000-0000-0000-0000-0000000000a3'
    where id = 'f1200000-0000-0000-0000-0000000000d1';

  select publisher_verified into v_verified
    from public.property_listings where id = v_listing;
  if not v_verified then
    raise exception 'VALIDATION FAIL: granting the badge did not reach the existing listing';
  end if;
  raise notice 'PASS  granting the badge propagates to the poster''s listings';
end
$$;

-- -----------------------------------------------------------------------------
-- 2. A real-estate administrator cannot grant a badge; a super admin can.
--    The role check lives in the trigger, so it holds for a direct write too.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', 'f1200000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
do $$
begin
  begin
    update public.real_estate_memberships
      set verified_at = now(), verified_by = 'f1200000-0000-0000-0000-0000000000a4'
      where id = 'f1200000-0000-0000-0000-0000000000d2';
    raise exception 'VALIDATION FAIL: a real-estate admin granted a verification badge';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a real-estate admin is refused the verification grant';
  end;
end
$$;
rollback;

begin;
select set_config('request.jwt.claim.sub', 'f1200000-0000-0000-0000-0000000000a3', true);
set local role authenticated;
do $$
declare
  v_verified timestamptz;
begin
  update public.real_estate_memberships
    set verified_at = now(), verified_by = 'f1200000-0000-0000-0000-0000000000a3'
    where id = 'f1200000-0000-0000-0000-0000000000d2';

  select verified_at into v_verified
    from public.real_estate_memberships where id = 'f1200000-0000-0000-0000-0000000000d2';
  if v_verified is null then
    raise exception 'VALIDATION FAIL: a super admin could not grant the badge';
  end if;
  raise notice 'PASS  a super admin grants the verification badge';
end
$$;
rollback;

-- -----------------------------------------------------------------------------
-- 3. The poster is the agent's user when an agent manages the listing.
-- -----------------------------------------------------------------------------
do $$
declare
  v_region uuid;
  v_listing uuid;
  v_verified boolean;
begin
  select id into v_region from public.regions order by sort_order limit 1;

  -- The agent's membership is approved and now verified (set in block 2's second
  -- half; re-assert it here so this block does not depend on that rollback).
  update public.real_estate_memberships
    set status = 'approved', verified_at = now(), verified_by = 'f1200000-0000-0000-0000-0000000000a3'
    where id = 'f1200000-0000-0000-0000-0000000000d2';

  insert into public.property_listings
    (slug, listing_type, property_kind, property_type, status, region_id,
     title, description, owner_id, agent_id)
  values
    ('p4-agent-listing', 'sale', 'house', 'residential', 'draft', v_region,
     'Phase 4 agent listing',
     'A listing managed by a verified agent on behalf of its owner.',
     'f1200000-0000-0000-0000-0000000000a1',
     'f1200000-0000-0000-0000-0000000000b1')
  returning id, publisher_verified into v_listing, v_verified;

  if not v_verified then
    raise exception 'VALIDATION FAIL: an agent-managed listing did not take the agent''s badge';
  end if;
  raise notice 'PASS  an agent-managed listing takes the agent''s badge';

  -- Revoking the agent's badge reaches the listing.
  update public.real_estate_memberships
    set verified_at = null, verified_by = null
    where id = 'f1200000-0000-0000-0000-0000000000d2';

  select publisher_verified into v_verified
    from public.property_listings where id = v_listing;
  if v_verified then
    raise exception 'VALIDATION FAIL: revoking the badge did not clear the listing';
  end if;
  raise notice 'PASS  revoking the badge clears the poster''s listings';
end
$$;

-- -----------------------------------------------------------------------------
-- 4. Leaving `approved` drops the badge. A suspended member keeps no trust mark.
-- -----------------------------------------------------------------------------
do $$
declare
  v_verified_at timestamptz;
  v_listing_verified boolean;
begin
  update public.real_estate_memberships
    set status = 'suspended', suspended_at = now(), suspension_reason = 'validation'
    where id = 'f1200000-0000-0000-0000-0000000000d1';

  select verified_at into v_verified_at
    from public.real_estate_memberships where id = 'f1200000-0000-0000-0000-0000000000d1';
  if v_verified_at is not null then
    raise exception 'VALIDATION FAIL: a suspended membership kept its badge';
  end if;

  select publisher_verified into v_listing_verified
    from public.property_listings where slug = 'p4-landlord-listing';
  if v_listing_verified then
    raise exception 'VALIDATION FAIL: suspension did not clear the listing''s badge';
  end if;
  raise notice 'PASS  suspension drops the badge from the membership and its listings';
end
$$;

-- -----------------------------------------------------------------------------
-- Cleanup. The listing rows cascade their own translation rows, and the
-- memberships and profiles are removed explicitly.
-- -----------------------------------------------------------------------------
delete from public.property_listings
  where slug in ('p4-landlord-listing', 'p4-agent-listing');
delete from public.real_estate_memberships
  where id in ('f1200000-0000-0000-0000-0000000000d1', 'f1200000-0000-0000-0000-0000000000d2');
delete from public.agent_profiles
  where id = 'f1200000-0000-0000-0000-0000000000b1';
delete from public.profiles
  where id in (
    'f1200000-0000-0000-0000-0000000000a1',
    'f1200000-0000-0000-0000-0000000000a2',
    'f1200000-0000-0000-0000-0000000000a3',
    'f1200000-0000-0000-0000-0000000000a4'
  );
delete from auth.users
  where id in (
    'f1200000-0000-0000-0000-0000000000a1',
    'f1200000-0000-0000-0000-0000000000a2',
    'f1200000-0000-0000-0000-0000000000a3',
    'f1200000-0000-0000-0000-0000000000a4'
  );

select 'ALL PUBLISHER VERIFICATION VALIDATIONS PASSED' as result;
