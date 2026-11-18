-- =============================================================================
-- Phase 7 — administrative content lifecycle and deletion behaviour.
--
-- Proves, against a freshly migrated database, that:
--
--   1. a department editor (a real-estate admin who is not a super admin) cannot
--      hard-delete a listing — the trigger refuses, so the `for all` policy's
--      DELETE grant is not a removal path;
--   2. `archive_listing` archives and records the operator reason in the audit
--      trail, and refuses without a reason;
--   3. `delete_listing_permanently` is super-admin only;
--   4. the retention gate refuses a listing that has analytics/inquiry events and
--      permits one that has none — deleting the row, its children and its
--      translation rows;
--   5. the deletion is recorded in the audit trail with the prior status.
--
-- Fixture rows are written as the migration owner (the default role) because
-- `listing_events` and `content_translations` have no browser insert policy; the
-- assertions that model a caller switch to `authenticated` explicitly. Run after
-- the migrations. The harness drives this with a non-psql client, so there are no
-- `\i`/`\set` meta-commands.
-- =============================================================================

do $$
declare
  v_super uuid;
  v_admin uuid;
  v_clean uuid;
  v_retained uuid;
  v_region uuid;
  v_status text;
  v_reason text;
begin
  -- ---------------------------------------------------------------------------
  -- Fixtures. `handle_new_user` provisions a customer profile on insert, so each
  -- admin is promoted after the auth row exists.
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, email, encrypted_password, email_confirmed_at)
  values
    ('00000000-0000-0000-0000-0000000007a1', 'super7a@example.test', 'x', now()),
    ('00000000-0000-0000-0000-0000000007a2', 'admin7a@example.test', 'x', now())
  on conflict (id) do nothing;

  v_super := '00000000-0000-0000-0000-0000000007a1';
  v_admin := '00000000-0000-0000-0000-0000000007a2';

  update public.profiles set role = 'super_admin' where id = v_super;
  update public.profiles set role = 'real_estate_admin' where id = v_admin;

  -- `property_listings.region_id` is NOT NULL, so a fixture needs a real region.
  select id into v_region from public.regions order by sort_order limit 1;
  if v_region is null then
    raise exception 'VALIDATION FAIL: the geography seed produced no region';
  end if;

  -- A clean listing with no retained history, and one that has an analytics event.
  insert into public.property_listings (
    id, reference, slug, listing_type, property_kind, property_type,
    status, source, region_id, locality, title, description, price_minor, currency
  )
  values (
    '00000000-0000-0000-0000-0000000007c1', 'KC-RE-700001', 'kc-7a-clean',
    'sale', 'house', 'residential', 'draft', 'admin', v_region, 'Limbe',
    'Clean listing', 'A listing with no history.', 1000000, 'XAF'
  )
  on conflict (id) do nothing;

  insert into public.property_listings (
    id, reference, slug, listing_type, property_kind, property_type,
    status, source, region_id, locality, title, description, price_minor, currency
  )
  values (
    '00000000-0000-0000-0000-0000000007c2', 'KC-RE-700002', 'kc-7a-history',
    'sale', 'house', 'residential', 'published', 'admin', v_region, 'Douala',
    'Retained listing', 'A listing with an inquiry.', 2000000, 'XAF'
  )
  on conflict (id) do nothing;

  v_clean := '00000000-0000-0000-0000-0000000007c1';
  v_retained := '00000000-0000-0000-0000-0000000007c2';

  -- Retained history for the second listing: a view event. This is what the
  -- retention gate keys on.
  insert into public.listing_events (listing_id, event_type, visitor_digest)
  values (v_retained, 'view', repeat('a', 64));

  -- A translation row for the clean listing, so the deletion's cleanup of the
  -- FK-less translation tables is exercised.
  insert into public.content_translations (
    entity_type, entity_id, field_name, locale, value, state
  )
  values ('property_listing', v_clean, 'title', 'fr', 'Annonce propre', 'pending')
  on conflict (entity_type, entity_id, field_name, locale) do nothing;

  -- ---------------------------------------------------------------------------
  -- (1) A department editor cannot hard-delete a listing.
  -- ---------------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  begin
    delete from public.property_listings where id = v_clean;
    raise exception 'VALIDATION FAIL: a real-estate admin hard-deleted a listing';
  exception
    when insufficient_privilege then
      null; -- expected
  end;

  if not exists (select 1 from public.property_listings where id = v_clean) then
    raise exception 'VALIDATION FAIL: the listing was deleted despite the refusal';
  end if;

  raise notice 'PASS  a department editor cannot hard-delete a listing';

  -- ---------------------------------------------------------------------------
  -- (2) Archive records the reason and refuses without one.
  -- ---------------------------------------------------------------------------
  begin
    perform public.archive_listing(v_clean, '   ');
    raise exception 'VALIDATION FAIL: archive_listing accepted an empty reason';
  exception
    when check_violation then
      null; -- expected
  end;

  perform public.archive_listing(v_clean, 'Duplicate of KC-RE-700002');

  select status into v_status from public.property_listings where id = v_clean;
  if v_status <> 'archived' then
    raise exception 'VALIDATION FAIL: archive_listing left status = %', v_status;
  end if;

  select reason into v_reason
  from public.audit_logs
  where entity_type = 'property_listing'
    and entity_id = v_clean::text
    and action = 'property_archived'
  order by created_at desc
  limit 1;

  if v_reason is distinct from 'Duplicate of KC-RE-700002' then
    raise exception 'VALIDATION FAIL: the archive reason was not audited (got %)', v_reason;
  end if;

  raise notice 'PASS  archiving records the operator reason';

  -- ---------------------------------------------------------------------------
  -- (3) Permanent deletion is super-admin only.
  -- ---------------------------------------------------------------------------
  begin
    perform public.delete_listing_permanently(v_clean, 'A sufficiently long reason');
    raise exception 'VALIDATION FAIL: a non-super-admin deleted a listing permanently';
  exception
    when insufficient_privilege then
      null; -- expected
  end;

  raise notice 'PASS  permanent deletion is super-admin only';

  -- ---------------------------------------------------------------------------
  -- (4) The retention gate, as the super admin.
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_super::text, true);

  -- A reason shorter than the minimum is refused before the retention check.
  begin
    perform public.delete_listing_permanently(v_clean, 'too short');
    raise exception 'VALIDATION FAIL: permanent deletion accepted a short reason';
  exception
    when check_violation then
      null; -- expected
  end;

  -- A retained listing (it has an analytics event) is refused.
  begin
    perform public.delete_listing_permanently(v_retained, 'A sufficiently long reason');
    raise exception 'VALIDATION FAIL: a listing with retained history was deleted';
  exception
    when check_violation then
      null; -- expected
  end;

  if not exists (select 1 from public.property_listings where id = v_retained) then
    raise exception 'VALIDATION FAIL: the retained listing was deleted anyway';
  end if;

  raise notice 'PASS  a listing with retained history cannot be deleted';

  -- ---------------------------------------------------------------------------
  -- (5) A clean listing deletes, its translation rows clear, and it is audited.
  -- ---------------------------------------------------------------------------
  perform public.delete_listing_permanently(v_clean, 'Fixture cleanup after the assertion');

  if exists (select 1 from public.property_listings where id = v_clean) then
    raise exception 'VALIDATION FAIL: the clean listing was not deleted';
  end if;

  if exists (
    select 1 from public.content_translations
    where entity_type = 'property_listing' and entity_id = v_clean
  ) then
    raise exception 'VALIDATION FAIL: the deletion left translation rows behind';
  end if;

  if exists (
    select 1 from public.translation_entries
    where entity_type = 'property_listing' and entity_id = v_clean
  ) then
    raise exception 'VALIDATION FAIL: the deletion left translation index entries behind';
  end if;

  if not exists (
    select 1 from public.audit_logs
    where entity_type = 'property_listing'
      and entity_id = v_clean::text
      and action = 'property_deleted'
      and reason = 'Fixture cleanup after the assertion'
  ) then
    raise exception 'VALIDATION FAIL: the permanent deletion was not audited';
  end if;

  raise notice 'PASS  a clean listing is deleted, its translation rows cleared, and the deletion audited';

  -- ---------------------------------------------------------------------------
  -- Cleanup. Nothing this script created should outlive it.
  -- ---------------------------------------------------------------------------
  reset role;

  delete from public.translation_entries
  where entity_type = 'property_listing' and entity_id = v_retained;
  delete from public.content_translations
  where entity_type = 'property_listing' and entity_id = v_retained;
  delete from public.listing_events where listing_id = v_retained;
  delete from public.property_listings where id = v_retained;
  delete from public.audit_logs
  where entity_type = 'property_listing'
    and entity_id in (v_clean::text, v_retained::text);
  delete from public.profiles where id in (v_super, v_admin);
  delete from auth.users where id in (v_super, v_admin);

  raise notice 'PASS  admin content lifecycle and deletion behaviour verified';
end
$$;
