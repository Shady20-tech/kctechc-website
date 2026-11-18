-- =============================================================================
-- Phase 7 — Administrative content lifecycle: archive, permanent deletion and
-- the audit reason.
--
-- The console could already create, edit, publish, unpublish and (for listings)
-- move a row through its lifecycle. What it could not do was remove anything, and
-- what it *could* do silently was hard-delete: every content table carries a
-- `for all` write policy, and `for all` includes DELETE. So a department editor
-- could issue a DELETE through PostgREST and cascade away a listing's media,
-- localized slugs, private details, favourites and analytics — leaving nothing to
-- explain where the record went, which is exactly what the phase forbids.
--
-- This migration adds the missing half and closes that hole. Three decisions:
--
-- ## 1. Archive is the default, and it carries a reason
--
-- `archive_listing` is the supported way to take a listing out of circulation. It
-- is a thin wrapper over the existing lifecycle: it sets the audit reason and
-- moves the row to `archived`, and `enforce_listing_lifecycle` validates the
-- transition and `audit_listing_changes` records it, exactly as for any other
-- status change. The wrapper exists so the operator's reason reaches the audit
-- row, which a bare `update status = 'archived'` cannot carry.
--
-- ## 2. Permanent deletion is super-admin only, and retention-gated
--
-- `delete_listing_permanently` refuses unless the caller is a super admin AND the
-- listing has no retained history: no analytics or inquiry events, no owner
-- submission, no recorded owner authorization, no legal document. A listing that
-- has any of those must be archived, never deleted, because deleting it would
-- destroy the record of an inquiry, a decision or an authorization that other
-- rows and the audit trail refer to. The check is in the function, not the
-- application, so a direct PostgREST call is bound by it too.
--
-- ## 3. A raw DELETE of a content row is refused
--
-- `forbid_unsanctioned_delete` is a BEFORE DELETE trigger on the four content
-- tables (`property_listings`, `products`, `electrical_projects`, `insights`).
-- It raises unless the caller is a super admin or a trusted context (`auth.uid()
-- is null` — service role, psql, a migration, the validation harness). This is
-- what turns the `for all` policies' DELETE grant into something the tier model
-- actually intends: a department editor authors content, and only a super admin
-- removes it. The delete RPC runs as a super-admin caller, so it passes.
--
-- The audit trail is *not* deleted with the row. An audit row's `entity_id`
-- pointing at a now-deleted record is correct: the trail's purpose is to record
-- that the deletion happened and who did it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The operator's reason, on the audit row.
--
-- `audit_logs.metadata` is a jsonb bag for structured context; a reason is a
-- sentence a human reads in the log table, so it earns its own column. Nullable,
-- because most actions (a plain edit) have no reason and an empty string is not a
-- reason.
-- -----------------------------------------------------------------------------
alter table public.audit_logs
  add column if not exists reason text;

comment on column public.audit_logs.reason is
  'The operator-supplied justification for a privileged action, when one is required (archive, permanent deletion). Null when the action carries no reason.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_reason_length'
  ) then
    alter table public.audit_logs
      add constraint audit_logs_reason_length check (
        reason is null or char_length(reason) between 1 and 500
      );
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2. Reading the reason a caller set for the current transaction.
--
-- The reason travels to the audit trigger through a transaction-local setting
-- rather than a parameter, because the trigger is what writes the audit row and a
-- trigger cannot be handed one. `set_config(..., true)` scopes it to the
-- transaction, so it cannot leak into the next request on a pooled connection,
-- and `missing_ok = true` means a write that set no reason simply gets null.
-- -----------------------------------------------------------------------------
create or replace function public.audit_reason()
returns text
language sql
stable
as $$
  select nullif(btrim(current_setting('kc.audit_reason', true)), '');
$$;

comment on function public.audit_reason is
  'The transaction-local operator reason (GUC kc.audit_reason) for the audit trigger to attach. Null when none was set.';

-- -----------------------------------------------------------------------------
-- 3. Attach the reason to every listing audit row.
--
-- Redefined rather than replaced-in-place because a new column is being written.
-- The action classification is unchanged; only the reason column is added, so an
-- audit row written before this migration and one written after mean the same
-- thing.
-- -----------------------------------------------------------------------------
create or replace function public.audit_listing_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'property_created';
  elsif new.status <> old.status then
    v_action := case new.status
      when 'published' then 'property_published'
      when 'rejected' then 'property_rejected'
      when 'archived' then 'property_archived'
      when 'sold' then 'property_sold'
      when 'rented' then 'property_rented'
      when 'pending_review' then 'property_submitted'
      else 'property_status_changed'
    end;
  elsif new.is_featured is distinct from old.is_featured then
    v_action := 'property_featured_changed';
  elsif new.agent_id is distinct from old.agent_id then
    v_action := 'property_agent_assigned';
  else
    v_action := 'property_updated';
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata, reason
  )
  values (
    auth.uid(),
    v_action,
    'property_listing',
    new.id::text,
    jsonb_build_object(
      'reference', new.reference,
      'status', new.status,
      'fromStatus', case when tg_op = 'UPDATE' then old.status::text end,
      'toStatus', new.status::text,
      'source', new.source::text,
      'agentId', new.agent_id
    ),
    public.audit_reason()
  );

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Record a permanent deletion.
--
-- An AFTER DELETE trigger, so it fires for the RPC and for a trusted direct
-- delete alike. It captures the previous state — the reference and the status the
-- row held when it went — because after the delete there is nothing left to read.
-- -----------------------------------------------------------------------------
create or replace function public.audit_listing_deletion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata, reason
  )
  values (
    auth.uid(),
    'property_deleted',
    'property_listing',
    old.id::text,
    jsonb_build_object(
      'reference', old.reference,
      'slug', old.slug,
      'fromStatus', old.status::text,
      'source', old.source::text
    ),
    public.audit_reason()
  );

  return old;
end;
$$;

comment on function public.audit_listing_deletion is
  'Records a permanent listing deletion in the audit trail, with the reference and prior status the row held.';

drop trigger if exists property_listings_audit_delete on public.property_listings;
create trigger property_listings_audit_delete
  after delete on public.property_listings
  for each row execute function public.audit_listing_deletion();

-- -----------------------------------------------------------------------------
-- 5. Refuse an unsanctioned hard delete.
--
-- One function, attached to all four content tables. A department editor authors
-- content and may archive it; only a super admin removes a row. A trusted context
-- (`auth.uid() is null`) is admitted because migrations, the service role and the
-- validation harness run there — the same convention `forbid_self_role_change`
-- and `enforce_listing_lifecycle` use.
-- -----------------------------------------------------------------------------
create or replace function public.forbid_unsanctioned_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return old;
  end if;

  raise exception
    'Deleting a % is restricted to a super administrator; archive it instead',
    tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

comment on function public.forbid_unsanctioned_delete is
  'Refuses a hard delete of a content row unless the caller is a super admin or a trusted context. Archive is the default removal.';

drop trigger if exists property_listings_forbid_delete on public.property_listings;
create trigger property_listings_forbid_delete
  before delete on public.property_listings
  for each row execute function public.forbid_unsanctioned_delete();

drop trigger if exists products_forbid_delete on public.products;
create trigger products_forbid_delete
  before delete on public.products
  for each row execute function public.forbid_unsanctioned_delete();

drop trigger if exists electrical_projects_forbid_delete on public.electrical_projects;
create trigger electrical_projects_forbid_delete
  before delete on public.electrical_projects
  for each row execute function public.forbid_unsanctioned_delete();

drop trigger if exists insights_forbid_delete on public.insights;
create trigger insights_forbid_delete
  before delete on public.insights
  for each row execute function public.forbid_unsanctioned_delete();

-- -----------------------------------------------------------------------------
-- 6. Archive a listing, with a reason.
-- -----------------------------------------------------------------------------
create or replace function public.archive_listing(
  p_listing_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_real_estate_admin() then
    raise exception 'Only a real-estate administrator may archive a listing'
      using errcode = 'insufficient_privilege';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Archiving a listing requires a reason'
      using errcode = 'check_violation';
  end if;

  -- Scoped to the transaction so the audit trigger reads it for this change only.
  perform set_config('kc.audit_reason', btrim(p_reason), true);

  update public.property_listings
  set status = 'archived'
  where id = p_listing_id;

  if not found then
    raise exception 'Unknown listing %', p_listing_id
      using errcode = 'no_data_found';
  end if;
end;
$$;

comment on function public.archive_listing is
  'Archives a listing, recording the operator reason in the audit trail. The lifecycle trigger validates the transition.';

-- -----------------------------------------------------------------------------
-- 7. Permanently delete a listing, super-admin only and retention-gated.
-- -----------------------------------------------------------------------------
create or replace function public.delete_listing_permanently(
  p_listing_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing public.property_listings;
  v_retained text;
begin
  -- Super admin alone. Permanent deletion is the one operation the retention
  -- rules exist to constrain, so it is not delegated to the tier that manages
  -- listings day to day.
  if not public.is_super_admin() then
    raise exception 'Only a super administrator may permanently delete a listing'
      using errcode = 'insufficient_privilege';
  end if;

  -- A reason is required and must be substantive: "the row has to go" is a
  -- decision a person is accountable for, and an empty field is not an
  -- explanation.
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'Permanent deletion requires a reason of at least 10 characters'
      using errcode = 'check_violation';
  end if;

  select * into v_listing
  from public.property_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Unknown listing %', p_listing_id
      using errcode = 'no_data_found';
  end if;

  -- Retention gate. Any of these is history that other records and the audit
  -- trail refer to; a listing that has them is archived, never deleted.
  select string_agg(reason, ', ')
  into v_retained
  from (
    select 'inquiries or analytics' as reason
    where exists (select 1 from public.listing_events where listing_id = p_listing_id)
    union all
    select 'an owner submission'
    where exists (select 1 from public.listing_submissions where listing_id = p_listing_id)
    union all
    select 'an owner authorization'
    where exists (select 1 from public.listing_owner_authorizations where listing_id = p_listing_id)
    union all
    select 'a legal document'
    where exists (select 1 from public.listing_legal_documents where listing_id = p_listing_id)
  ) retained;

  if v_retained is not null then
    raise exception
      'Listing % has retained history (%) and cannot be permanently deleted; archive it instead',
      p_listing_id, v_retained
      using errcode = 'check_violation';
  end if;

  perform set_config('kc.audit_reason', btrim(p_reason), true);

  -- The translation index, localized values and SEO overrides carry no foreign
  -- key to the listing, so they do not cascade and must be cleared explicitly or
  -- they would outlive the row and keep the deleted listing's keys in the Tolgee
  -- queue. The listing's own children (media, slugs, private details, public
  -- location, favourites) cascade on the delete below.
  delete from public.translation_entries
  where entity_type = 'property_listing' and entity_id = p_listing_id;
  delete from public.content_translations
  where entity_type = 'property_listing' and entity_id = p_listing_id;
  delete from public.entity_seo
  where entity_type = 'property_listing' and entity_id = p_listing_id;

  delete from public.property_listings where id = p_listing_id;
end;
$$;

comment on function public.delete_listing_permanently is
  'Permanently deletes a listing. Super-admin only, requires a substantive reason, and refuses when the listing has retained history.';

-- -----------------------------------------------------------------------------
-- 8. Classify the new functions for the EXECUTE surface.
--
-- Supabase grants EXECUTE on a new function to anon/authenticated by default, and
-- the Phase 12 hardening migration ran before these existed, so the classification
-- is repeated here (the same rule any later migration that adds a function must
-- follow). `archive_listing` and `delete_listing_permanently` are called by the
-- application through the session client so `auth.uid()` attributes the actor, so
-- they stay reachable by `authenticated`; their internal role guards are the
-- control. The trigger functions and the reason helper are not browser-callable at
-- all, so they are revoked and never re-granted.
-- -----------------------------------------------------------------------------
revoke all on function public.archive_listing(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_listing_permanently(uuid, text) from public, anon, authenticated;
revoke all on function public.audit_reason() from public, anon, authenticated;
revoke all on function public.forbid_unsanctioned_delete() from public, anon, authenticated;
revoke all on function public.audit_listing_deletion() from public, anon, authenticated;

grant execute on function public.archive_listing(uuid, text) to authenticated, service_role;
grant execute on function public.delete_listing_permanently(uuid, text) to authenticated, service_role;
grant execute on function public.audit_reason() to service_role;
grant execute on function public.forbid_unsanctioned_delete() to service_role;
grant execute on function public.audit_listing_deletion() to service_role;

-- -----------------------------------------------------------------------------
-- 9. Self-check the guards are installed.
--
-- A cheap structural assertion, not a behavioural one: the behaviour is proven in
-- `supabase/validate/110_admin_deletion_behaviour.sql`, which runs against a fresh
-- database. This catches the failure mode where a trigger is dropped by a later
-- edit and nothing else notices.
-- -----------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(expected.tbl, ', ')
  into v_missing
  from (
    values
      ('property_listings'), ('products'),
      ('electrical_projects'), ('insights')
  ) as expected(tbl)
  where not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = expected.tbl
      and t.tgname = expected.tbl || '_forbid_delete'
      and not t.tgisinternal
  );

  if v_missing is not null then
    raise exception 'VALIDATION FAIL: hard-delete guard missing on %', v_missing;
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'property_listings' and t.tgname = 'property_listings_audit_delete'
  ) then
    raise exception 'VALIDATION FAIL: the listing deletion audit trigger is missing';
  end if;

  raise notice 'PASS  admin content lifecycle guards are installed';
end
$$;
