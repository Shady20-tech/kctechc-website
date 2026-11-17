-- =============================================================================
-- Phase 3 — Landlord and agent dashboards: the self-service workflow.
--
-- This migration opens the owner/agent listing workflow the dashboards need, and
-- closes a hole that opening it would otherwise expose.
--
-- ## The hole, reproduced before it was fixed
--
-- `enforce_listing_lifecycle` (migration 19) refuses to publish a listing whose
-- `source = 'owner_submission'` unless an administrator has approved a submission
-- row for it. That is the review gate the brief requires — "Submitting a property
-- must not immediately publish it."
--
-- But the gate keys on `source`, and nothing pinned `source` for a non-admin
-- session. `listing_source` defaults to `'admin'`, and the ownership policy added
-- in migration 58 (`property_listings_insert_own_owner`) requires only
-- `owner_id = auth.uid() and current_user_has_membership('landlord')`. So an
-- approved landlord could:
--
--   1. insert a listing without naming a source  -> it is born `source = 'admin'`
--   2. update its status to `published`          -> the owner_submission gate does
--      not apply, and the owner UPDATE policy permits it
--
-- Reproduced against a fresh database built from the full migration set: the
-- insert succeeded with `source = 'admin'` and the publish succeeded, with no
-- submission row and no administrator involved. The review workflow was
-- therefore optional for exactly the users it exists to constrain.
--
-- ## The fix
--
-- A non-administrator's write is pinned to a source that carries the review
-- gate. `enforce_listing_lifecycle` now sets `source := 'owner_submission'` on
-- INSERT when the caller is not a real-estate administrator, and refuses any
-- attempt by such a caller to *set* a different source. An administrator's write
-- is untouched, so the import path (`source = 'import'`) and the console's
-- `source = 'admin'` both keep working.
--
-- Why pin rather than reject: the dashboard's guided form does not ask the
-- landlord to classify their own listing, so the value is not theirs to choose.
-- Pinning makes the correct source a property of who is writing, which cannot be
-- forgotten by a future caller — the same reasoning that puts attribution in a
-- trigger rather than a CHECK.
--
-- ## Also here
--
-- The owner needs to attach photographs and legal evidence, and to submit for
-- review. Those writes were admin-only or agent-only; this migration adds the
-- owner path to `listing_media` and `listing_submissions`, and grants the owner
-- `select` on their own submission so the dashboard can show moderation status.
--
-- No new function is created except the redefinition of `enforce_listing_lifecycle`
-- and `enforce_listing_ownership`, both already trigger functions, so the Phase 12
-- EXECUTE allow-list is unaffected — and the revoke is repeated below anyway,
-- because Supabase re-grants EXECUTE on `create or replace`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pin the source of a non-administrator write.
--
-- The predicate is "the caller has a real user identity and is not a real-estate
-- administrator". A caller with no identity at all — the service role, a psql
-- session, a migration, the validation harness — is a trusted context and keeps
-- whatever source it names, which is the same convention `forbid_self_role_change`
-- (migration 24) uses for `auth.uid() is null`. An anonymous API request also has
-- no identity, but `anon` has no insert policy on `property_listings` at all, so
-- RLS refuses it before this trigger is reached.
--
-- This deliberately catches an agent (`real_estate_agent`) as well as a landlord:
-- `is_real_estate_admin()` excludes the agent role on purpose, because an agent
-- manages only their own listings. An agent's listing therefore also enters the
-- review workflow, which is what "new listings must enter the appropriate review
-- workflow" requires.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_listing_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approved boolean;
  v_is_admin boolean;
begin
  -- Reference is always generated, never supplied by the caller, so it cannot be
  -- chosen to collide with another listing.
  if tg_op = 'INSERT' and new.reference is null then
    new.reference := public.generate_listing_reference();
  end if;

  -- Trusted when there is no user identity to judge (service role, psql,
  -- migration, harness) or when the identity is an administrator's.
  v_is_admin := auth.uid() is null or public.is_real_estate_admin();

  -- A non-administrator's listing carries the review gate, whatever they sent.
  -- Pinned on INSERT so the row is born correct, and enforced on UPDATE so a
  -- later edit cannot strip the gate off an existing listing by rewriting the
  -- source to 'admin'.
  if not v_is_admin then
    if tg_op = 'INSERT' then
      new.source := 'owner_submission';
    elsif new.source <> old.source and new.source <> 'owner_submission' then
      raise exception
        'Only a real-estate administrator may set a listing source to % (listing %)',
        new.source, new.id
        using errcode = 'check_violation';
    end if;
  end if;

  -- A status that has not changed is not a transition. Re-saving a published
  -- listing's description must not be refused, and must not reset its timestamps.
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and not public.listing_status_transition_allowed(old.status, new.status) then
    raise exception 'Illegal listing status transition: % → %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- -------------------------------------------------- Owner submission gate ---
  -- An owner submission may only reach a public state through an approved review
  -- row. Checked here rather than in the publish action because an import, a
  -- migration or a psql session would otherwise be able to publish one.
  if new.status in ('published', 'under_offer', 'sold', 'rented')
     and new.source = 'owner_submission' then
    select exists (
      select 1
      from public.listing_submissions s
      where s.listing_id = new.id
        and s.status = 'approved'
        and s.reviewed_at is not null
    )
    into v_approved;

    if not v_approved then
      raise exception
        'An owner-submitted listing cannot be published until an administrator has approved it (listing %)',
        new.id
        using errcode = 'check_violation';
    end if;
  end if;

  -- ------------------------------------------------------- Lifecycle stamps ---
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.status in ('sold', 'rented', 'archived') and new.closed_at is null then
    new.closed_at := now();
  end if;

  -- Returning to the market clears the closed timestamp, so a relisted property
  -- does not carry a stale "closed" date that a report would count.
  if new.status in ('published', 'under_offer') then
    new.closed_at := null;
  end if;

  return new;
end;
$$;

comment on function public.enforce_listing_lifecycle is
  'Pins a non-administrator listing to source=owner_submission, validates status transitions, gates owner submissions on approval, and maintains published_at/closed_at.';

-- The trigger must fire on an UPDATE of `source` too, or the anti-stripping
-- check above would never run. It previously fired only on `status`.
drop trigger if exists property_listings_enforce_lifecycle on public.property_listings;
create trigger property_listings_enforce_lifecycle
  before insert or update of status, source on public.property_listings
  for each row execute function public.enforce_listing_lifecycle();

-- -----------------------------------------------------------------------------
-- An owner submission must record the owner as its submitter.
--
-- `enforce_listing_ownership` already pins `created_by` to `auth.uid()`. The same
-- is done for the owner, so a listing created by any future path is attributable
-- even if the insert policy is later relaxed.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_listing_ownership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agent_user uuid;
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;

  -- A non-administrator owns what they create. The ownership insert policy
  -- already requires `owner_id = auth.uid()`, but pinning it here means the
  -- relationship survives any future relaxation of that policy. A caller with no
  -- identity (service role, psql, migration, harness) is left alone.
  if tg_op = 'INSERT'
     and new.owner_id is null
     and auth.uid() is not null
     and not public.is_real_estate_admin() then
    new.owner_id := auth.uid();
  end if;

  -- 1. A manager must be entitled to manage.
  if new.managed_by is not null then
    if not (
      public.user_has_membership(new.managed_by, 'agent')
      or exists (
        select 1 from public.profiles pr
        where pr.id = new.managed_by and pr.role = 'real_estate_admin'
      )
    ) then
      raise exception
        'A listing manager must be an approved agent or a real-estate administrator (account %)',
        new.managed_by
        using errcode = 'check_violation';
    end if;
  end if;

  -- 2. An agent acting for a different owner needs a live authorization.
  if new.status in ('published', 'under_offer', 'sold', 'rented')
     and new.agent_id is not null and new.owner_id is not null then
    select a.user_id into v_agent_user
    from public.agent_profiles a
    where a.id = new.agent_id;

    if v_agent_user is not null and v_agent_user <> new.owner_id then
      if not exists (
        select 1
        from public.listing_owner_authorizations auth
        where auth.listing_id = new.id
          and auth.owner_user_id = new.owner_id
          and auth.agent_id = new.agent_id
          and auth.revoked_at is null
      ) then
        raise exception
          'An agent may only publish for a different owner with a live authorization on file (listing %, owner %, agent %)',
          new.id, new.owner_id, new.agent_id
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_listing_ownership is
  'Pins owner_id/created_by for a non-administrator insert, requires a listing manager to be an approved agent/admin, and requires a live authorization before an agent may publish a listing for a different owner.';

-- -----------------------------------------------------------------------------
-- Owner submissions: an owner may read and create their own.
--
-- The existing policies are admin-only for read and agent-only for insert, so a
-- landlord could not submit their own listing for review at all. These add the
-- owner path without narrowing either.
-- -----------------------------------------------------------------------------
create policy "listing_submissions_select_own_owner"
  on public.listing_submissions for select
  to authenticated
  using (
    submitted_by = auth.uid()
    or exists (
      select 1 from public.property_listings p
      where p.id = listing_id
        and (p.owner_id = auth.uid() or p.managed_by = auth.uid())
    )
  );

create policy "listing_submissions_insert_own_owner"
  on public.listing_submissions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.property_listings p
      where p.id = listing_id
        and (p.owner_id = auth.uid() or p.managed_by = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Owner media: an owner manages the gallery on their own listing.
--
-- `listing_media_write_agent` covers the agent's own listings and
-- `listing_media_write_admin` covers the console. Neither reaches a landlord who
-- owns a listing but has no `agent_profiles` row, so the guided form's
-- photograph step would be refused for the exact user the dashboard serves.
-- -----------------------------------------------------------------------------
create policy "listing_media_write_own_owner"
  on public.listing_media for all
  to authenticated
  using (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id
        and (p.owner_id = auth.uid() or p.managed_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id
        and (p.owner_id = auth.uid() or p.managed_by = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- EXECUTE classification.
--
-- Both functions are trigger functions, so Postgres does not check EXECUTE for
-- them, but Supabase re-grants EXECUTE on `create or replace` and the Phase 12
-- hardening migration ran long before this one. The revoke is repeated here, per
-- the rule that a function is classified in the migration that creates it.
-- -----------------------------------------------------------------------------
revoke all on function public.enforce_listing_lifecycle() from public;
revoke all on function public.enforce_listing_lifecycle() from anon, authenticated;
grant execute on function public.enforce_listing_lifecycle() to service_role;

revoke all on function public.enforce_listing_ownership() from public;
revoke all on function public.enforce_listing_ownership() from anon, authenticated;
grant execute on function public.enforce_listing_ownership() to service_role;

-- -----------------------------------------------------------------------------
-- Assert the boundary.
--
-- The property that matters: an approved landlord cannot publish without a
-- review, however they arrange the columns. Proven against the database, because
-- the application cannot demonstrate a trigger — the Server Action's own guard is
-- a message, not the control.
-- -----------------------------------------------------------------------------
do $$
declare
  v_owner uuid := 'c0000000-0000-0000-0000-0000000000e1';
  v_admin uuid := 'c0000000-0000-0000-0000-0000000000e2';
  v_region uuid;
  v_listing uuid;
  v_source public.listing_source;
  v_status public.listing_status;
begin
  insert into auth.users (id, email) values
    (v_owner, 'phase3-owner@example.test'),
    (v_admin, 'phase3-admin@example.test')
  on conflict (id) do nothing;

  -- `handle_new_user` provisions a `customer` profile when the auth row is
  -- inserted, so the role must be applied as an update afterwards — an insert
  -- with `on conflict do nothing` would silently leave the administrator a
  -- customer and this assertion would then pass for the wrong reason.
  update public.profiles set role = 'real_estate_admin' where id = v_admin;
  update public.profiles set role = 'customer' where id = v_owner;

  insert into public.real_estate_memberships
    (user_id, membership_type, status, approved_by, approved_at)
  values (v_owner, 'landlord', 'approved', v_owner, now())
  on conflict (user_id, membership_type) do update set status = 'approved';

  select id into v_region from public.regions order by sort_order limit 1;
  if v_region is null then
    raise exception 'Phase 3 assertion needs at least one region';
  end if;

  -- (a) A landlord's insert is pinned to owner_submission even though they named
  --     no source (and the column would otherwise default to 'admin').
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_owner::text, true);

    insert into public.property_listings
      (slug, listing_type, property_kind, property_type, status, region_id,
       title, description, owner_id)
    values
      ('phase3-owner-listing', 'sale', 'house', 'residential', 'draft', v_region,
       'Phase 3 owner listing', 'A listing inserted by an approved landlord with no source named.', v_owner)
    returning id into v_listing;
  exception
    when insufficient_privilege then
      raise exception 'Phase 3 FAILED: an approved landlord could not create a listing';
  end;
  reset role;

  select source, status into v_source, v_status
  from public.property_listings where id = v_listing;

  if v_source <> 'owner_submission' then
    raise exception
      'Phase 3 FAILED: a landlord insert was not pinned to owner_submission (source %)',
      v_source;
  end if;

  -- (b) The landlord cannot publish it — the review gate now applies.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    update public.property_listings set status = 'published' where id = v_listing;
    reset role;
    raise exception 'Phase 3 FAILED: a landlord published a listing without a review';
  exception
    when check_violation then
      null; -- expected: the lifecycle gate refused it
    when insufficient_privilege then
      raise exception 'Phase 3 FAILED: the publish was refused by a policy, not the review gate';
  end;
  reset role;

  -- (c) The landlord cannot strip the gate by rewriting the source.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    update public.property_listings set source = 'admin' where id = v_listing;
    reset role;
    raise exception 'Phase 3 FAILED: a landlord rewrote a listing source to admin';
  exception
    when check_violation then
      null; -- expected
    when insufficient_privilege then
      null; -- also acceptable: refused before the trigger
  end;
  reset role;

  select source into v_source from public.property_listings where id = v_listing;
  if v_source <> 'owner_submission' then
    raise exception 'Phase 3 FAILED: the source was changed to %', v_source;
  end if;

  -- (d) An administrator's write keeps its own source, so the console and the
  --     import path are unaffected.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    insert into public.property_listings
      (slug, listing_type, property_kind, property_type, status, region_id,
       title, description, source)
    values
      ('phase3-admin-listing', 'sale', 'house', 'residential', 'published', v_region,
       'Phase 3 admin listing', 'A listing inserted by an administrator, which keeps the source it names.', 'admin')
    returning id into v_listing;
  exception
    when insufficient_privilege then
      raise exception 'Phase 3 FAILED: an administrator could not create a listing';
  end;
  reset role;

  select source, status into v_source, v_status
  from public.property_listings where id = v_listing;

  if v_source <> 'admin' or v_status <> 'published' then
    raise exception
      'Phase 3 FAILED: an administrator write was altered (source %, status %)',
      v_source, v_status;
  end if;

  -- Clean up, so a migration applied to a live database leaves nothing behind.
  --
  -- Deleting the listing is not enough: inserting one fired
  -- `sync_listing_translation_index` (migration 22), which wrote the listing's
  -- `translation_entries`, `content_translations` and queued
  -- `translation_sync_jobs` rows. Those have no foreign key to
  -- `property_listings`, so nothing cascades and they would survive as orphans —
  -- a durable queue of sync work for a listing that no longer exists. Delete them
  -- by the fixture ids while the listings still exist, entries first so the job
  -- rows cascade.
  delete from public.translation_entries t
   where t.entity_type = 'property_listing'
     and t.entity_id in (
       select id from public.property_listings
       where slug in ('phase3-owner-listing', 'phase3-admin-listing'));
  delete from public.content_translations c
   where c.entity_type = 'property_listing'
     and c.entity_id in (
       select id from public.property_listings
       where slug in ('phase3-owner-listing', 'phase3-admin-listing'));

  delete from public.property_listings where slug in ('phase3-owner-listing', 'phase3-admin-listing');
  delete from public.real_estate_memberships where user_id = v_owner;
  delete from public.profiles where id in (v_owner, v_admin);
  delete from auth.users where id in (v_owner, v_admin);

  raise notice 'Phase 3: a landlord cannot publish without review, and cannot strip the gate';
end
$$;
