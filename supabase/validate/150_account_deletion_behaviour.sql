-- =============================================================================
-- Account deletion behaviour.
--
-- Proves, against a freshly migrated database, that:
--
--   1. `detach_and_archive_user_content` archives only the listings the account
--      owns, and steps a `pending_review` listing back to `draft` first so the
--      lifecycle trigger's transition rules are respected rather than bypassed;
--   2. it removes the account's `agent_profiles` row, so a deleted agent leaves
--      no ghost record the public agent policy would still expose;
--   3. it returns the account's avatar and KYC document paths, because those rows
--      are about to be cascade-deleted and the paths would otherwise be lost;
--   4. deleting the auth user cascades the profile, memberships, favourites, KYC
--      applications and documents, while leaving orders, inquiries and audit rows
--      in place with their user columns nulled — the business record survives;
--   5. the last active super administrator cannot be deleted;
--   6. a browser caller that is not a super administrator is refused;
--   7. the function is not executable by a browser key.
--
-- Fixture rows are written as the migration owner (the default role) because the
-- `auth` schema and several content tables have no browser insert policy; the
-- assertions that model a caller switch to `authenticated` explicitly. Run after
-- the migrations. The harness drives this with a non-psql client, so there are no
-- `\i`/`\set` meta-commands.
-- =============================================================================

do $$
declare
  v_super uuid := '00000000-0000-0000-0000-000000000d01';
  v_owner uuid := '00000000-0000-0000-0000-000000000d02';
  v_other uuid := '00000000-0000-0000-0000-000000000d03';
  v_admin uuid := '00000000-0000-0000-0000-000000000d04';
  v_region uuid;
  v_owned_listing uuid;
  v_pending_listing uuid;
  v_other_listing uuid;
  v_order uuid;
  v_inquiry uuid;
  v_application uuid;
  v_count integer;
  v_paths integer;
  v_returned text[];
  v_status public.listing_status;
  v_actor uuid;
  v_reactivate uuid[];
begin
  -- ---------------------------------------------------------------------------
  -- Fixtures.
  --
  -- `handle_new_user` provisions a customer profile on insert, so each role is
  -- applied afterwards. The extra super admin exists so that deleting `v_owner`
  -- is not the "last super administrator" case; that case is asserted separately
  -- at the end.
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, email, encrypted_password, email_confirmed_at)
  values
    (v_super,  'super-delete@example.test', 'x', now()),
    (v_owner,  'owner-delete@example.test', 'x', now()),
    (v_other,  'other-delete@example.test', 'x', now()),
    (v_admin,  'admin-delete@example.test', 'x', now())
  on conflict (id) do nothing;

  update public.profiles set role = 'super_admin'       where id = v_super;
  update public.profiles set role = 'real_estate_admin' where id = v_admin;

  select id into v_region from public.regions order by name limit 1;
  if v_region is null then
    raise exception 'VALIDATION SETUP FAIL: no region seeded';
  end if;

  -- ---------------------------------------------------------------------------
  -- 1. Listings: owned ones archive, another account's stays untouched.
  --
  -- The listing is inserted directly (not through the owner dashboard) so the
  -- fixture can hold a `published` row and a `pending_review` row at once.
  -- `forbid_unsanctioned_delete` does not fire here because nothing is deleted.
  -- ---------------------------------------------------------------------------
  insert into public.property_listings (
    reference, slug, listing_type, property_kind, property_type, status, source,
    region_id, owner_id, title, description, price_minor, currency, published_at
  ) values (
    'KC-RE-900001', 'owned-published-listing', 'sale', 'house', 'residential',
    'published', 'admin', v_region, v_owner,
    'Owned published listing',
    'Fixture listing owned by the account that is about to be deleted.',
    10000000, 'XAF', now()
  ) returning id into v_owned_listing;

  insert into public.property_listings (
    reference, slug, listing_type, property_kind, property_type, status, source,
    region_id, owner_id, title, description, price_minor, currency
  ) values (
    'KC-RE-900002', 'owned-pending-listing', 'sale', 'house', 'residential',
    'pending_review', 'admin', v_region, v_owner,
    'Owned pending listing',
    'Fixture pending submission owned by the same account being deleted.',
    12000000, 'XAF'
  ) returning id into v_pending_listing;

  insert into public.property_listings (
    reference, slug, listing_type, property_kind, property_type, status, source,
    region_id, owner_id, title, description, price_minor, currency, published_at
  ) values (
    'KC-RE-900003', 'other-account-listing', 'sale', 'house', 'residential',
    'published', 'admin', v_region, v_other,
    'Someone else''s listing',
    'Fixture owned by an account that is not being deleted, so it must survive.',
    9000000, 'XAF', now()
  ) returning id into v_other_listing;

  -- ---------------------------------------------------------------------------
  -- 2. Records that must SURVIVE the deletion, detached from the account.
  -- ---------------------------------------------------------------------------
  insert into public.orders (
    reference, status, customer_id, email, full_name, currency,
    idempotency_key, access_token
  ) values (
    'KC-ORD-20260101-DEL001', 'pending_payment', v_owner,
    'owner-delete@example.test', 'Owner To Delete', 'XAF',
    'fixture-idempotency-delete-0001',
    'fixture-access-token-delete-0000000000000001'
  ) returning id into v_order;

  insert into public.inquiries (
    reference, full_name, email, subject, message, consent_given, consent_at,
    assigned_to
  ) values (
    'KC-20260101-DEL002', 'Owner To Delete', 'owner-delete@example.test',
    'Fixture inquiry', 'An inquiry assigned to the account being deleted.',
    true, now(), v_owner
  ) returning id into v_inquiry;

  -- ---------------------------------------------------------------------------
  -- 3. Records that must be CASCADE-deleted with the account.
  -- ---------------------------------------------------------------------------
  insert into public.real_estate_memberships (user_id, membership_type, status)
  values (v_owner, 'landlord', 'approved')
  on conflict (user_id, membership_type) do nothing;

  insert into public.listing_favorites (user_id, listing_id)
  values (v_owner, v_other_listing)
  on conflict do nothing;

  -- An agent record must disappear too, or the public agent policy keeps
  -- exposing a deleted identity.
  insert into public.agent_profiles (user_id, display_name, slug, bio, public_phone)
  values (
    v_owner, 'Owner Agent', 'owner-agent-delete',
    'Fixture agent biography for the deletion assertion.', '+237600000000'
  )
  on conflict do nothing;

  insert into public.real_estate_kyc_applications (
    user_id, membership_type, status, full_legal_name, email, phone,
    country_of_residence, date_of_birth, id_type, id_issuing_country
  ) values (
    v_owner, 'landlord', 'draft', 'Owner To Delete', 'owner-delete@example.test',
    '+237600000000', 'Cameroon', '1990-01-01', 'national_id_card', 'Cameroon'
  ) returning id into v_application;

  insert into public.real_estate_kyc_documents (
    application_id, kind, storage_path, original_filename, detected_mime, byte_size
  ) values (
    v_application, 'id_front', 'applications/' || v_application || '/front.jpg',
    'front.jpg', 'image/jpeg', 1024
  );

  update public.profiles
  set avatar_path = 'avatars/' || v_owner || '/avatar.jpg'
  where id = v_owner;

  -- ---------------------------------------------------------------------------
  -- 4. Run the pre-deletion cleanup as the service role would.
  --
  -- `auth.uid()` is null in this block, which is the trusted context the function
  -- accepts. The browser-caller case is asserted separately below.
  -- ---------------------------------------------------------------------------
  select coalesce(array_agg(object_path), '{}')
  into v_returned
  from public.detach_and_archive_user_content(v_owner);

  -- The avatar and the KYC document, and nothing else.
  if array_length(v_returned, 1) <> 2 then
    raise exception
      'VALIDATION FAIL: expected 2 storage paths, got % (%)',
      coalesce(array_length(v_returned, 1), 0), v_returned;
  end if;

  if not exists (
    select 1 from unnest(v_returned) as p where p like 'avatars/%'
  ) then
    raise exception 'VALIDATION FAIL: the avatar path was not returned';
  end if;

  if not exists (
    select 1 from unnest(v_returned) as p where p like 'applications/%'
  ) then
    raise exception 'VALIDATION FAIL: the KYC document path was not returned';
  end if;

  select status into v_status from public.property_listings where id = v_owned_listing;
  if v_status <> 'archived' then
    raise exception 'VALIDATION FAIL: the owned published listing is % not archived', v_status;
  end if;

  select status into v_status from public.property_listings where id = v_pending_listing;
  if v_status <> 'archived' then
    raise exception 'VALIDATION FAIL: the owned pending listing is % not archived', v_status;
  end if;

  select status into v_status from public.property_listings where id = v_other_listing;
  if v_status <> 'published' then
    raise exception
      'VALIDATION FAIL: another account''s listing was % — the cleanup reached outside its owner',
      v_status;
  end if;

  select count(*) into v_count from public.agent_profiles where user_id = v_owner;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: the deleted account still has an agent profile';
  end if;

  -- ---------------------------------------------------------------------------
  -- 5. Delete the auth user, as `auth.admin.deleteUser` does, and assert the
  --    cascade split.
  -- ---------------------------------------------------------------------------
  delete from auth.users where id = v_owner;

  select count(*) into v_count from public.profiles where id = v_owner;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: the profile survived the auth user deletion';
  end if;

  select count(*) into v_count
  from public.real_estate_memberships where user_id = v_owner;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: a membership survived the deletion';
  end if;

  select count(*) into v_count from public.favorites where user_id = v_owner;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: a favourite survived the deletion';
  end if;

  select count(*) into v_count
  from public.real_estate_kyc_applications where user_id = v_owner;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: a KYC application survived the deletion';
  end if;

  -- The documents cascade through the application, so count by the application id
  -- captured before the delete.
  select count(*) into v_count
  from public.real_estate_kyc_documents where application_id = v_application;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: a KYC document survived the deletion';
  end if;

  -- The business records survive, detached.
  select customer_id into v_actor from public.orders where id = v_order;
  if v_actor is not null then
    raise exception 'VALIDATION FAIL: the order still points at the deleted account';
  end if;
  select count(*) into v_count from public.orders where id = v_order;
  if v_count <> 1 then
    raise exception 'VALIDATION FAIL: the order was deleted with the account';
  end if;

  select assigned_to into v_actor from public.inquiries where id = v_inquiry;
  if v_actor is not null then
    raise exception 'VALIDATION FAIL: the inquiry still points at the deleted account';
  end if;
  select count(*) into v_count from public.inquiries where id = v_inquiry;
  if v_count <> 1 then
    raise exception 'VALIDATION FAIL: the inquiry was deleted with the account';
  end if;

  -- ---------------------------------------------------------------------------
  -- 6. A browser caller that is not a super administrator is refused.
  --
  -- Tested through the *internal* guard rather than through the grant, because
  -- the two are separate controls and the revoke would mask a missing guard. The
  -- role is `service_role` (so the function is callable at all) while the JWT
  -- subject is an ordinary administrator, which is exactly the shape of a bug
  -- where a Server Action forgets to check the role: `auth.uid()` is set, and it
  -- is not a super admin.
  -- ---------------------------------------------------------------------------
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  begin
    perform public.detach_and_archive_user_content(v_other);
    raise exception 'VALIDATION FAIL: a non-super-admin caller was allowed to delete an account';
  exception
    when insufficient_privilege then
      null; -- expected: the internal guard refused
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  -- ---------------------------------------------------------------------------
  -- 7. The last active super administrator cannot be deleted.
  --
  -- Deactivation rather than demotion: the guard counts *active* super admins, so
  -- suspending the others produces the condition without rewriting anyone's role,
  -- and the original state is restored afterwards.
  -- ---------------------------------------------------------------------------
  select coalesce(array_agg(p.id), '{}')
  into v_reactivate
  from public.profiles p
  where p.role = 'super_admin' and p.is_active and p.id <> v_super;

  update public.profiles
  set is_active = false
  where role = 'super_admin' and is_active and id <> v_super;

  begin
    perform public.detach_and_archive_user_content(v_super);
    raise exception 'VALIDATION FAIL: the last super administrator was allowed to be deleted';
  exception
    when check_violation then
      null; -- expected
  end;

  update public.profiles
  set is_active = true
  where id = any (v_reactivate);

  -- ---------------------------------------------------------------------------
  -- 8. The function is not reachable with a browser key.
  -- ---------------------------------------------------------------------------
  if has_function_privilege(
       'anon',
       'public.detach_and_archive_user_content(uuid)',
       'EXECUTE'
     ) then
    raise exception 'VALIDATION FAIL: anon may execute detach_and_archive_user_content';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.detach_and_archive_user_content(uuid)',
       'EXECUTE'
     ) then
    raise exception 'VALIDATION FAIL: authenticated may execute detach_and_archive_user_content';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.detach_and_archive_user_content(uuid)',
       'EXECUTE'
     ) then
    raise exception 'VALIDATION FAIL: service_role cannot execute detach_and_archive_user_content';
  end if;

  raise notice 'PASS  account deletion archives owned listings, cascades the account, preserves business records, and refuses the last super admin';

  -- ---------------------------------------------------------------------------
  -- Cleanup. The fixtures are removed so a re-run starts clean and the harness
  -- leaves no orphaned translation queue behind.
  --
  -- The translation rows must go BEFORE the listings: they have no foreign key to
  -- `property_listings`, so deleting the listing cascades nothing and the entries
  -- would be stranded. This is the general hazard for any translatable entity.
  -- ---------------------------------------------------------------------------
  delete from public.translation_entries
  where entity_type = 'property_listing'
    and entity_id in (v_owned_listing, v_pending_listing, v_other_listing);

  delete from public.content_translations
  where entity_type = 'property_listing'
    and entity_id in (v_owned_listing, v_pending_listing, v_other_listing);

  delete from public.listing_favorites where listing_id in (v_other_listing);
  delete from public.orders where id = v_order;
  delete from public.inquiries where id = v_inquiry;

  -- The listings are archived, and the archive state is what the delete guard
  -- permits; `auth.uid()` is null in this block, so the guard allows the delete.
  delete from public.property_listings
  where id in (v_owned_listing, v_pending_listing, v_other_listing);

  delete from public.profiles where id in (v_super, v_other, v_admin);
  delete from auth.users where id in (v_super, v_other, v_admin);
end;
$$;
