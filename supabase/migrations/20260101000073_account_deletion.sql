-- =============================================================================
-- Account deletion: a user may delete their own account, and a super admin may
-- delete any account.
--
-- ## What "delete the account" means here
--
-- The account itself lives in `auth.users`; `public.profiles` is a child row that
-- cascades from it. Deleting the auth user therefore removes the profile, and
-- through it the tables that hang off the account:
--
--   on delete cascade  -> favourites, saved searches, alert preferences,
--                         real-estate memberships, KYC applications and their
--                         documents
--   on delete set null -> orders, carts, inquiries, audit rows, listing
--                         attribution columns
--
-- The `set null` side is deliberate and pre-existing: an order is a business
-- record that must survive the customer, and an audit trail that vanished with
-- its actor would be worthless. Deleting the account does not delete the
-- business's books.
--
-- ## What the database does, and what it cannot
--
-- Removing a row from `auth.users` is the Supabase Admin API's job
-- (`auth.admin.deleteUser`), not SQL: the `auth` schema is not ours to write and
-- the API is the supported path. So the split is:
--
--   * this migration owns the *content* consequences of a deletion — archiving
--     what the account was advertising and detaching its agent identity — and
--     reports the storage objects that must be purged;
--   * the Server Action calls the Admin API and then removes those objects.
--
-- ## Why listings are archived rather than deleted
--
-- A landlord who leaves has usually posted property. Leaving those listings
-- published under a now-null owner would keep advertising a property nobody is
-- accountable for, and would keep a "verified" badge pointing at a deleted
-- identity. Deleting them would destroy other people's records (favourites,
-- inquiries, the business's history). Archiving is the middle path and matches
-- the repository's stated default: archive is the removal, hard delete is the
-- exception.
--
-- The archive walks the status machine rather than assigning `archived`
-- directly, because `enforce_listing_lifecycle` validates every transition and
-- would refuse `pending_review -> archived`. A pending submission goes back to
-- draft first, which is a permitted step, and is then archived.
--
-- ## The last super administrator cannot be deleted
--
-- Same reasoning as `forbid_self_role_change`: not a privilege question but a
-- lockout one. If the only super administrator deletes their account, no
-- remaining account can grant the role back through the console and recovery is
-- a manual SQL edit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Archive what the account was advertising, detach its agent identity, and
--    report the storage objects that belong to it.
--
-- SECURITY DEFINER because it writes rows the caller may not be allowed to write
-- directly (an owner's listing is scoped to the owner by RLS, and the caller here
-- is the service role acting on the user's behalf). It is granted to
-- `service_role` only, so it is not a browser-reachable path to archive someone
-- else's portfolio.
-- -----------------------------------------------------------------------------
create or replace function public.detach_and_archive_user_content(p_user_id uuid)
returns table (object_bucket text, object_path text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing record;
  v_super_admins integer;
begin
  if p_user_id is null then
    raise exception 'A user id is required'
      using errcode = 'check_violation';
  end if;

  -- Trusted context (service role, psql, a migration, the harness) has no
  -- `auth.uid()`; a browser session must be a super administrator. This mirrors
  -- the predicate `forbid_unsanctioned_delete` and `forbid_self_role_change` use,
  -- so the two privileged deletion paths agree on who is trusted.
  if auth.uid() is not null and not public.is_super_admin() then
    raise exception 'Only a super administrator may delete an account'
      using errcode = 'insufficient_privilege';
  end if;

  -- Lockout guard. Counted among active super admins, because an inactive one
  -- cannot sign in to restore the role.
  select count(*) into v_super_admins
  from public.profiles p
  where p.role = 'super_admin' and p.is_active;

  if v_super_admins <= 1
     and exists (
       select 1 from public.profiles p
       where p.id = p_user_id and p.role = 'super_admin'
     ) then
    raise exception 'The last super administrator cannot be deleted'
      using errcode = 'check_violation';
  end if;

  -- ------------------------------------------------------------- Listings ---
  -- Only what the account owns. A listing an agent merely manages stays with its
  -- owner, who is a different account and is not being deleted.
  for v_listing in
    select id, status
    from public.property_listings
    where owner_id = p_user_id
  loop
    -- `pending_review -> archived` is not a legal transition, so step back to
    -- draft (which is) before archiving.
    if v_listing.status = 'pending_review' then
      update public.property_listings
      set status = 'draft'
      where id = v_listing.id;
    end if;

    if v_listing.status <> 'archived' then
      update public.property_listings
      set status = 'archived'
      where id = v_listing.id;
    end if;
  end loop;

  -- --------------------------------------------------------- Agent record ---
  -- `agent_profiles.user_id` is `on delete set null`, so the row would survive
  -- the account as a ghost with no user behind it — still selectable by the
  -- public agent policy. Remove it. Listings that pointed at it have their
  -- `agent_id` nulled by the existing foreign key.
  delete from public.agent_profiles where user_id = p_user_id;

  -- ---------------------------------------------------------------- Objects ---
  -- The rows that hold these paths are about to be cascade-deleted, so the paths
  -- are captured here — after the deletion there is nothing left to read them
  -- from, and the objects would be orphaned in the bucket forever.
  return query
    select 'avatars'::text, p.avatar_path
    from public.profiles p
    where p.id = p_user_id and p.avatar_path is not null
    union all
    select 'kyc-documents'::text, d.storage_path
    from public.real_estate_kyc_documents d
    join public.real_estate_kyc_applications a on a.id = d.application_id
    where a.user_id = p_user_id;
end;
$$;

comment on function public.detach_and_archive_user_content(uuid) is
  'Pre-deletion cleanup for an account: archives the listings it owns, removes its agent profile, refuses to delete the last super administrator, and returns the storage objects that must be purged. Service-role only.';

-- -----------------------------------------------------------------------------
-- 2. Classify the new function for the EXECUTE surface.
--
-- Supabase grants EXECUTE on a new `public` function to `anon` and
-- `authenticated` by default, and the Phase 12 hardening migration ran long
-- before this one existed. `30_function_execute_hardening.sql` asserts the
-- subset property, so an unclassified function fails the harness rather than
-- shipping as a browser-reachable write.
-- -----------------------------------------------------------------------------
revoke all on function public.detach_and_archive_user_content(uuid)
  from public, anon, authenticated;
grant execute on function public.detach_and_archive_user_content(uuid)
  to service_role;
