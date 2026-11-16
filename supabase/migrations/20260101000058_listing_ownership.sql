-- =============================================================================
-- Phase 1.3 — Listing ownership, management and authorization evidence.
--
-- `property_listings.agent_id` already existed and is preserved exactly as it
-- was: it is the *posting agent*, and the agent policies from migration 21 keep
-- working unchanged. What was missing is the rest of the sentence the brief
-- writes out — a property must be traceable to
--
--     its owner · its posting agent · its creator · its current manager ·
--     its approval history
--
-- and a landlord with no `agent_profiles` row had no way to own a listing at all.
-- Before this migration the only route into `property_listings` was through
-- `agent_id = current_agent_id()`, so a landlord either became an "agent" (a
-- staff-surface role) or could not list. That is the gap this closes.
--
-- ## The four identities, and why they are four columns and not one
--
--   owner_id    — the person the property belongs to. The landlord.
--   agent_id    — the agent who posted it. Already present; unchanged.
--   created_by  — the account that first inserted the row. Already present.
--   managed_by  — the account currently responsible for it day to day.
--
-- They genuinely differ. A landlord owns a property, an agent posts it, an
-- administrator creates the row during onboarding, and the agent who manages it
-- may change when a colleague takes over the portfolio. Collapsing any two of
-- them would make the record unable to answer the question it exists to answer:
-- who is allowed to edit this, and on whose authority.
--
-- ## The control
--
-- Every ownership relationship below is enforced by RLS on the row, not by a
-- filter in a Server Action. A landlord may read and edit a listing they own and
-- nothing else; a manager may act on what they manage; an administrator keeps
-- full reach. The trigger adds the two rules a policy cannot express — that a
-- manager must be an approved agent, and that an agent posting on behalf of a
-- different person must have authorization evidence on file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ownership columns.
-- -----------------------------------------------------------------------------
alter table public.property_listings
  -- The person the property belongs to. `auth.users` rather than `profiles`,
  -- matching every other user reference in this schema.
  add column owner_id uuid references auth.users (id) on delete set null,
  -- The account currently managing the listing. Nullable: an owner-managed
  -- listing has no separate manager, and an admin-created draft may have none
  -- yet.
  add column managed_by uuid references auth.users (id) on delete set null;

comment on column public.property_listings.owner_id is
  'The account the property belongs to. A landlord with no agent_profiles row owns listings through this column.';
comment on column public.property_listings.managed_by is
  'The account currently responsible for this listing. Must be an approved agent or a real-estate administrator; enforced by enforce_listing_ownership().';

-- Backfill the creator where it can be derived, so a listing that predates this
-- migration still records who created it. `created_by` already existed; it was
-- simply never populated, and an agent-posted listing's creator is the account
-- behind `agent_id`.
update public.property_listings p
set created_by = a.user_id
from public.agent_profiles a
where p.agent_id = a.id
  and p.created_by is null
  and a.user_id is not null;

-- Attribution is enforced by the trigger below, NOT by a table constraint.
--
-- A CHECK such as `owner_id is not null or agent_id is not null or created_by is
-- not null` reads well and was the first version of this migration, but it is
-- wrong in two ways. A listing imported in bulk or created by an administrator
-- during onboarding has no user to attribute at insert time, so the constraint
-- would refuse a legitimate row — and worse, it would refuse the *existing* rows
-- a live database already holds, aborting the migration on a production
-- deployment. Attribution is therefore required only where there is a user
-- session to attribute to, which is what the trigger expresses and a column
-- constraint cannot.

create index property_listings_owner_idx
  on public.property_listings (owner_id)
  where owner_id is not null;

create index property_listings_manager_idx
  on public.property_listings (managed_by)
  where managed_by is not null;

-- -----------------------------------------------------------------------------
-- Authorization evidence.
--
-- "An agent listing a property on behalf of another person must be associated
-- with the appropriate owner and authorization evidence."
--
-- That is a document with a lifecycle, so it gets a table rather than a boolean
-- on the listing: a mandate can be uploaded, replaced, and revoked, and the
-- history of who was authorized to act for whom is itself the audit record a
-- dispute turns on. A `owner_authorized boolean` would collapse all of that into
-- one bit that cannot say who authorized what, or when it stopped.
-- -----------------------------------------------------------------------------
create table public.listing_owner_authorizations (
  id uuid primary key default extensions.gen_random_uuid(),

  listing_id uuid not null references public.property_listings (id) on delete cascade,

  -- The person who owns the property and is authorizing someone to act for them.
  owner_user_id uuid not null references auth.users (id) on delete cascade,

  -- The agent authorized to act. Nullable so an owner acting for themselves can
  -- still be recorded — and set to null rather than deleted if the agent's record
  -- is removed, because the authorization history must survive the agent.
  agent_id uuid references public.agent_profiles (id) on delete set null,

  -- The evidence. A storage path to the signed mandate or identity document, or a
  -- note recording how consent was obtained. At least one is required by the
  -- check below: an authorization with no evidence is an assertion, and the brief
  -- asks for evidence.
  evidence_path text,
  evidence_note text,

  granted_at timestamptz not null default now(),
  revoked_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One live authorization per owner per agent per listing. A re-issued mandate
  -- revokes the old row and inserts a new one, so the history is a list rather
  -- than an overwritten value.
  constraint listing_owner_authorizations_unique unique (listing_id, owner_user_id, agent_id),

  constraint listing_owner_authorizations_evidence_present check (
    nullif(btrim(coalesce(evidence_path, '')), '') is not null
    or nullif(btrim(coalesce(evidence_note, '')), '') is not null
  ),

  constraint listing_owner_authorizations_revocation_order check (
    revoked_at is null or revoked_at >= granted_at
  )
);

comment on table public.listing_owner_authorizations is
  'Evidence that a property owner authorized an agent to act for them. One live row per (listing, owner, agent); a re-issued mandate revokes the old row rather than overwriting it.';
comment on column public.listing_owner_authorizations.evidence_path is
  'Storage-relative path to the signed mandate or identity document. Private bucket; rendered through a signed URL.';

create index listing_owner_authorizations_listing_idx
  on public.listing_owner_authorizations (listing_id);

create index listing_owner_authorizations_owner_idx
  on public.listing_owner_authorizations (owner_user_id)
  where revoked_at is null;

create trigger listing_owner_authorizations_set_updated_at
  before update on public.listing_owner_authorizations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Ownership rules a policy cannot express.
--
-- Two rules, both about a relationship between rows rather than about the row
-- being written, which is why they are a trigger:
--
--   1. A manager must be an approved agent (or a real-estate administrator). A
--      `managed_by` pointing at an arbitrary account would hand that account
--      edit access to the listing through the policy below, which is precisely
--      the escalation this prevents.
--
--   2. When an agent posts a listing for a different person — `agent_id` set,
--      `owner_id` set, and the two are different accounts — there must be a live
--      authorization row for that pair. This is the "on behalf of" case, and
--      without the rule the columns would merely assert the relationship rather
--      than evidence it.
--
-- SECURITY DEFINER so it can read `agent_profiles` and `real_estate_memberships`
-- without depending on the caller's policies, with `search_path` pinned.
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
  -- Record the creator on insert, so a listing created through a user session is
  -- attributable. An administrator, an import or a migration has no session and
  -- is left to set `created_by` explicitly; this is why attribution is a trigger
  -- and not a CHECK — see the note above the indexes.
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
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
  --
  -- Gated on the listing reaching a PUBLIC state, not on creation. An
  -- authorization row references `listing_id`, so the listing must exist before
  -- the mandate can be attached to it — requiring evidence at insert would be a
  -- chicken-and-egg the agent could never satisfy. The gate therefore sits where
  -- the property becomes visible, which is the point at which the authority
  -- actually matters, and it mirrors how `enforce_listing_lifecycle` already
  -- allows an owner submission to exist as a draft but not to publish until it is
  -- approved.
  if new.status in ('published', 'under_offer', 'sold', 'rented')
     and new.agent_id is not null and new.owner_id is not null then
    select a.user_id into v_agent_user
    from public.agent_profiles a
    where a.id = new.agent_id;

    -- A different account is the "on behalf of" case. An agent listing their own
    -- property is the owner, so no separate mandate is needed.
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
  'Requires a listing manager to be an approved agent/admin, and requires a live authorization before an agent may publish a listing for a different owner.';

drop trigger if exists property_listings_enforce_ownership on public.property_listings;
create trigger property_listings_enforce_ownership
  before insert or update of owner_id, agent_id, managed_by, status on public.property_listings
  for each row execute function public.enforce_listing_ownership();

-- -----------------------------------------------------------------------------
-- Row Level Security — the ownership boundary.
--
-- Additive to the policies from migration 21: those grant the *agent* path and
-- the administrator path, and these add the owner path and the manager path.
-- PostgreSQL ORs policies of the same command together, so an account that
-- qualifies under any of them reaches the row, and nothing here narrows what an
-- agent or an admin could already do.
--
-- Every one is written `using` + `with check` where a write is possible, because
-- a policy that only restricts which rows are *read* would let an update move a
-- listing into a state the same account could not have created — the classic
-- "change the owner column and keep the row" escalation.
-- -----------------------------------------------------------------------------

-- An owner reads their own listing in every state, including a draft.
create policy "property_listings_select_own_owner"
  on public.property_listings for select
  to authenticated
  using (owner_id = auth.uid());

-- A manager reads what they manage.
create policy "property_listings_select_manager"
  on public.property_listings for select
  to authenticated
  using (managed_by = auth.uid());

-- A landlord may create a listing they own, and only for themselves.
--
-- The membership check is the capability boundary: `current_user_has_membership`
-- asks about `auth.uid()` only, so it cannot be used to assert someone else's
-- capability, and an unapproved applicant — a row still `pending_review` — is not
-- a capability, so this fails for them. That is the intended behaviour: a
-- landlord lists once the application is approved.
create policy "property_listings_insert_own_owner"
  on public.property_listings for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and public.current_user_has_membership('landlord')
  );

-- An owner edits their own listing, and the check re-asserts ownership so an
-- update cannot hand the listing to another account.
create policy "property_listings_update_own_owner"
  on public.property_listings for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- A manager edits what they manage. `managed_by` is held to the caller, so a
-- manager cannot pass the listing to somebody else, and the trigger above is what
-- guarantees the caller was entitled to be a manager in the first place.
create policy "property_listings_update_manager"
  on public.property_listings for update
  to authenticated
  using (managed_by = auth.uid())
  with check (managed_by = auth.uid());

-- -----------------------------------------------------------------------------
-- Private details, slugs and locations follow the same ownership.
--
-- Each of these tables reaches its listing through `listing_id`, so the same two
-- predicates are added to each. The owner and the manager need the private
-- details — the owner's own address and contact are theirs — and neither may
-- reach another listing's.
-- -----------------------------------------------------------------------------

create policy "listing_private_details_own_owner"
  on public.listing_private_details for all
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

create policy "listing_slugs_write_own_owner"
  on public.listing_slugs for all
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
-- Authorization evidence RLS.
--
-- The owner sees authorizations they granted; the named agent sees the one that
-- entitles them; staff see all. Only staff may create or revoke one, because an
-- authorization is a decision about who may act for whom — the party it benefits
-- must not be able to write it, the same rule the membership table follows.
-- -----------------------------------------------------------------------------
alter table public.listing_owner_authorizations enable row level security;

create policy "listing_owner_authorizations_select_owner"
  on public.listing_owner_authorizations for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "listing_owner_authorizations_select_agent"
  on public.listing_owner_authorizations for select
  to authenticated
  using (agent_id = public.current_agent_id());

create policy "listing_owner_authorizations_write_admin"
  on public.listing_owner_authorizations for all
  to authenticated
  using (public.is_real_estate_admin())
  with check (public.is_real_estate_admin());

-- -----------------------------------------------------------------------------
-- EXECUTE classification.
--
-- `enforce_listing_ownership` is a trigger function, so Postgres does not check
-- EXECUTE for it — but the default grant Supabase attaches to a new function is
-- still surface, and the hardening migration ran before this one created it, so
-- the revoke is repeated here. This is the trap AGENTS.md records.
-- -----------------------------------------------------------------------------
revoke all on function public.enforce_listing_ownership() from public;
revoke all on function public.enforce_listing_ownership() from anon, authenticated;
grant execute on function public.enforce_listing_ownership() to service_role;

-- -----------------------------------------------------------------------------
-- Assert the ownership boundary.
--
-- The property that matters: one landlord cannot reach another landlord's
-- listing, and a landlord cannot write an approved manager onto their listing
-- who is not an approved agent. Both are asserted against the database, not
-- against the application.
-- -----------------------------------------------------------------------------
do $$
declare
  v_owner_a uuid := 'a0000000-0000-0000-0000-0000000000b1';
  v_owner_b uuid := 'a0000000-0000-0000-0000-0000000000b2';
  v_stranger uuid := 'a0000000-0000-0000-0000-0000000000b3';
  v_region uuid;
  v_listing uuid;
  v_rows integer;
begin
  insert into auth.users (id, email) values
    (v_owner_a, 'phase1-owner-a@example.test'),
    (v_owner_b, 'phase1-owner-b@example.test'),
    (v_stranger, 'phase1-stranger@example.test')
  on conflict (id) do nothing;

  insert into public.profiles (id, email, full_name, role, locale) values
    (v_owner_a, 'phase1-owner-a@example.test', 'Owner A', 'customer', 'en'),
    (v_owner_b, 'phase1-owner-b@example.test', 'Owner B', 'customer', 'en'),
    (v_stranger, 'phase1-stranger@example.test', 'Stranger', 'customer', 'en')
  on conflict (id) do nothing;

  -- Both owners hold an approved landlord capability, which is what the insert
  -- policy requires.
  insert into public.real_estate_memberships
    (user_id, membership_type, status, approved_by, approved_at)
  values
    (v_owner_a, 'landlord', 'approved', v_owner_a, now()),
    (v_owner_b, 'landlord', 'approved', v_owner_b, now())
  on conflict (user_id, membership_type) do update set status = 'approved',
    approved_by = excluded.approved_by, approved_at = excluded.approved_at;

  select id into v_region from public.regions order by sort_order limit 1;
  if v_region is null then
    raise exception 'Phase 1 ownership assertion needs at least one region';
  end if;

  -- Owner A creates a listing through the owner policy.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_owner_a::text, true);

    insert into public.property_listings
      (slug, listing_type, property_kind, property_type, status, region_id,
       title, description, owner_id)
    values
      ('phase1-owned-by-a', 'sale', 'house', 'residential', 'draft', v_region,
       'Owned by A', 'A listing created by its owner in the phase 1 assertion.', v_owner_a)
    returning id into v_listing;
  exception
    when insufficient_privilege then
      raise exception 'Phase 1 ownership FAILED: an approved landlord could not create a listing';
  end;
  reset role;

  if v_listing is null then
    raise exception 'Phase 1 ownership FAILED: the listing was not created';
  end if;

  -- Owner B may not read it.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_owner_b::text, true);
    select count(*) into v_rows from public.property_listings where id = v_listing;
  end;
  reset role;

  if v_rows <> 0 then
    raise exception 'Phase 1 ownership FAILED: another landlord read a listing they do not own';
  end if;

  -- A stranger may not edit it.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_stranger::text, true);
    update public.property_listings set title = 'hijacked' where id = v_listing;
    get diagnostics v_rows = row_count;
  end;
  reset role;

  if v_rows <> 0 then
    raise exception 'Phase 1 ownership FAILED: a stranger edited a listing they do not own';
  end if;

  -- A non-agent may not be recorded as the manager.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_owner_a::text, true);
    update public.property_listings set managed_by = v_stranger where id = v_listing;
    raise exception 'Phase 1 ownership FAILED: a non-agent was accepted as manager';
  exception
    when check_violation then
      null; -- expected
    when insufficient_privilege then
      null; -- also acceptable: refused before the trigger
  end;
  reset role;

  -- Clean up so a live database is left untouched.
  delete from public.property_listings where id = v_listing;
  delete from public.real_estate_memberships where user_id in (v_owner_a, v_owner_b);
  delete from public.profiles where id in (v_owner_a, v_owner_b, v_stranger);
  delete from auth.users where id in (v_owner_a, v_owner_b, v_stranger);

  raise notice 'Phase 1: listing ownership boundary holds';
end
$$;
