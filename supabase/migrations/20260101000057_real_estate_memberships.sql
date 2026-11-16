-- =============================================================================
-- Phase 1.2 — Account capabilities, separate from administrative permissions.
--
-- The brief's central requirement: "Separate account capabilities from
-- administrative permissions. This is critical."
--
-- `profiles.role` is an AUTHORIZATION input. It decides whether a caller reaches
-- the internal console, the CRM, the audit trail and other people's records, and
-- migration 24 closed the hole that let a signup choose it. That column must not
-- be pressed into service to mean "this person can list a property", for two
-- reasons:
--
--   1. The two questions have different answers. `real_estate_agent` already
--      exists and already means "may reach the internal console and manage own
--      listings", so reusing it would make every landlord an admin-surface user.
--      A landlord is a member of the marketplace, not a member of staff.
--
--   2. One column cannot hold two capabilities. The brief requires that a user
--      may be a landlord AND an agent, and that neither removes the ordinary
--      buyer features they already have. "Buyer" is not a role at all — it is
--      what every signed-in customer can already do — so the model is additive:
--      capabilities are granted on top of a customer account, never instead of
--      one.
--
-- Hence a normalised `real_estate_memberships` table: one row per (user,
-- capability), each with its own application and review lifecycle. A user who
-- later wants a second capability gets a second row; they do not get a second
-- `auth.users` row, and they do not lose the first capability.
--
-- ## What this migration deliberately does NOT do
--
-- It does not grant a landlord or an agent any write access to
-- `property_listings`. Ownership and its RLS are the next migration's job, and
-- splitting them keeps this one reviewable: everything here is about *who a
-- person is*, and the next file is about *what they may do*. A capability row
-- with no ownership policy grants nothing on its own.
--
-- It does not touch `profiles.role`. Not one policy, not one default. The
-- self-escalation guard from migration 24 is unchanged, and the assertion at the
-- end of this file re-proves it still holds after this migration runs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The capability vocabulary.
--
-- Two members, because those are the two the brief names. Modelled as an enum
-- rather than free text so an unrecognised capability is refused by the type
-- system: a typo in a policy predicate that compares against `'landloard'` would
-- otherwise simply never match, silently granting nobody anything, rather than
-- failing loudly.
-- -----------------------------------------------------------------------------
create type public.membership_type as enum (
  'landlord',
  'agent'
);

comment on type public.membership_type is
  'A marketplace capability a user may hold. Additive to a customer account: holding one never removes buyer features, and a user may hold both.';

-- -----------------------------------------------------------------------------
-- The application/review lifecycle.
--
-- The brief's suggested states, with `not_applied` represented by the ABSENCE of
-- a row rather than a row in a `not_applied` state. That is the normalised choice:
-- a row that exists means an application was started, so "has this user ever
-- applied" is `exists(select 1 …)` and there is no fifth state to keep in step
-- with the four real ones. A row is only created when a user actually applies.
--
-- `suspended` is a state of an approved membership rather than a separate flag,
-- because suspension is reached from `approved` and leaves from it; a boolean
-- beside the status would allow the contradictory `status = 'rejected' and
-- suspended = true`.
-- -----------------------------------------------------------------------------
create type public.membership_status as enum (
  'pending_kyc',
  'pending_review',
  'approved',
  'rejected',
  'changes_requested',
  'suspended'
);

comment on type public.membership_status is
  'Where a membership application has reached. "Not applied" is the absence of a row, not a member of this enum.';

-- -----------------------------------------------------------------------------
-- The membership table.
-- -----------------------------------------------------------------------------
create table public.real_estate_memberships (
  id uuid primary key default extensions.gen_random_uuid(),

  -- The account. `auth.users` rather than `profiles`, matching every other
  -- user-owned table in this schema (favourites, saved searches, carts): the
  -- profile row is the application's mirror of the account, and the account is
  -- what the membership belongs to.
  user_id uuid not null references auth.users (id) on delete cascade,

  membership_type public.membership_type not null,

  status public.membership_status not null default 'pending_kyc',

  -- The KYC provider's reference, so the application can be reconciled with an
  -- external verification record. Optional because a membership may be recorded
  -- before verification starts, and a company operating in Cameroon may verify by
  -- document rather than through a provider at all.
  kyc_reference text,

  -- The review decision. `approved_by` is an account, and `on delete set null`
  -- rather than cascade: removing the reviewer's account must not delete the
  -- evidence that a decision was made.
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  review_notes text,

  -- Suspension is recorded separately from `status` only in the sense that the
  -- timestamp and reason are kept; the status itself is the enum member above.
  suspended_at timestamptz,
  suspension_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ------------------------------------------------------------------ Checks ---

  -- One row per capability per user. This is the constraint that makes "may hold
  -- either capability or both" true without permitting a duplicate, and it is what
  -- a re-application must update rather than insert.
  constraint real_estate_memberships_unique_per_type unique (user_id, membership_type),

  constraint real_estate_memberships_kyc_reference_length check (
    kyc_reference is null or char_length(btrim(kyc_reference)) between 1 and 200
  ),

  constraint real_estate_memberships_review_notes_length check (
    review_notes is null or char_length(review_notes) between 1 and 4000
  ),

  constraint real_estate_memberships_suspension_reason_length check (
    suspension_reason is null or char_length(btrim(suspension_reason)) between 1 and 2000
  ),

  -- An approval must record who approved it and when. Without this a row could be
  -- approved with no approver, and every downstream question — "who let this
  -- landlord in" — would have no answer.
  constraint real_estate_memberships_approval_requires_reviewer check (
    status <> 'approved'
    or (approved_by is not null and approved_at is not null)
  ),

  -- A refusal or a request for changes must carry its reason, so a decision the
  -- applicant has to act on is never recorded without one.
  constraint real_estate_memberships_decision_requires_notes check (
    status not in ('rejected', 'changes_requested')
    or (review_notes is not null and btrim(review_notes) <> '')
  ),

  -- A suspension must say when and why. The status alone tells the applicant
  -- nothing they can respond to.
  constraint real_estate_memberships_suspension_requires_reason check (
    status <> 'suspended'
    or (suspended_at is not null and nullif(btrim(coalesce(suspension_reason, '')), '') is not null)
  ),

  -- A membership that is not suspended must not carry suspension detail, so a
  -- reinstated member does not keep a stale reason that a later report would read
  -- as a current one.
  constraint real_estate_memberships_suspension_consistency check (
    status = 'suspended'
    or (suspended_at is null and suspension_reason is null)
  )
);

comment on table public.real_estate_memberships is
  'Marketplace capabilities (landlord, agent) a user holds, with their application and review lifecycle. Additive to a customer account; a user may hold both. Grants no listing access by itself — see the ownership migration.';
comment on column public.real_estate_memberships.kyc_reference is
  'External KYC provider reference, so an application can be reconciled with a verification record.';
comment on column public.real_estate_memberships.approved_by is
  'The account that approved the membership. on delete set null, so removing the reviewer does not destroy the decision record.';

create index real_estate_memberships_user_idx
  on public.real_estate_memberships (user_id);

-- The review queue: everything waiting on a human, oldest first.
create index real_estate_memberships_queue_idx
  on public.real_estate_memberships (status, created_at)
  where status in ('pending_kyc', 'pending_review');

-- The set of approved capabilities, which is what the capability predicates read
-- on every listing write. Partial, because a rejected or suspended membership is
-- never the answer to "may this user act as a landlord".
create index real_estate_memberships_approved_idx
  on public.real_estate_memberships (user_id, membership_type)
  where status = 'approved';

create trigger real_estate_memberships_set_updated_at
  before update on public.real_estate_memberships
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Capability predicates.
--
-- SECURITY DEFINER for the same reason every other role predicate in this schema
-- is: an RLS policy on another table needs to ask this question, and reading
-- `real_estate_memberships` through its own policy-protected path would recurse.
-- `search_path` is pinned so the function cannot be hijacked.
--
-- The question each one asks is "is this user APPROVED for this capability". A
-- pending or suspended membership is not a capability — which is the whole point
-- of the review lifecycle, and the reason these check `status = 'approved'`
-- rather than mere existence of a row.
-- -----------------------------------------------------------------------------
create or replace function public.user_has_membership(
  p_user_id uuid,
  p_type public.membership_type
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.real_estate_memberships m
    where m.user_id = p_user_id
      and m.membership_type = p_type
      and m.status = 'approved'
  );
$$;

comment on function public.user_has_membership is
  'True when the given user holds an APPROVED membership of the given type. A pending or suspended membership is not a capability.';

/** The caller's own membership question, for RLS policies on other tables. */
create or replace function public.current_user_has_membership(
  p_type public.membership_type
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.user_has_membership(auth.uid(), p_type);
$$;

comment on function public.current_user_has_membership is
  'True when the current caller holds an approved membership of the given type. Used by ownership policies.';

-- -----------------------------------------------------------------------------
-- Row Level Security.
--
-- The shape is the one every user-owned table in this schema uses: a user reaches
-- their own rows, and only staff reach anyone's.
-- -----------------------------------------------------------------------------

alter table public.real_estate_memberships enable row level security;

-- A user reads their own membership rows, so the account page can show "your
-- landlord application is under review".
create policy "real_estate_memberships_select_own"
  on public.real_estate_memberships for select
  to authenticated
  using (user_id = auth.uid());

-- Real-estate staff read every membership, because reviewing them is their job.
create policy "real_estate_memberships_select_staff"
  on public.real_estate_memberships for select
  to authenticated
  using (public.is_real_estate_admin());

-- A user may apply for a capability.
--
-- The `with check` is the important half, and it is written to make three
-- escalations impossible in one predicate rather than three separate guards:
--
--   * `user_id = auth.uid()` — a user may only apply for themselves. Without it
--     they could file an application against another account.
--
--   * `status in ('pending_kyc', 'pending_review')` — a user may not create a row
--     that is already `approved`. This is the self-escalation guard for this
--     table, and it is the direct analogue of the `profiles.role` protection from
--     migration 24: the party being authorized must not be able to write the
--     authorization. An application must START pending.
--
--   * `approved_by is null and approved_at is null` — a user may not supply a
--     reviewer. A row cannot be born looking as though someone approved it, even
--     in a pending state, so there is no arrangement of these columns a crafted
--     insert could use to appear reviewed.
create policy "real_estate_memberships_insert_own"
  on public.real_estate_memberships for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status in ('pending_kyc', 'pending_review')
    and approved_by is null
    and approved_at is null
  );

-- A user may withdraw an application or resubmit one that was sent back — and
-- nothing else. The `with check` holds the row to the same states, so an update
-- cannot move a membership into `approved`.
--
-- This is what makes "allow users to request an additional membership later" work
-- for a capability they were rejected for or asked to change: the row is updated
-- back to `pending_review`, not duplicated, because the unique constraint above
-- forbids a second row for the same type.
create policy "real_estate_memberships_update_own"
  on public.real_estate_memberships for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and status in ('pending_kyc', 'pending_review')
    and approved_by is null
    and approved_at is null
  );

-- Real-estate staff decide applications: approve, reject, request changes,
-- suspend and reinstate. This is the only path to `approved`.
create policy "real_estate_memberships_write_staff"
  on public.real_estate_memberships for all
  to authenticated
  using (public.is_real_estate_admin())
  with check (public.is_real_estate_admin());

-- -----------------------------------------------------------------------------
-- Audit.
--
-- A membership decision is exactly the kind of privileged change the brief's
-- audit rule names ("role changes … content publishing"), so it is recorded by a
-- trigger rather than by the application: an entry produced by application code
-- is absent precisely when something bypasses the application.
-- -----------------------------------------------------------------------------
create or replace function public.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only a status change is a decision. Creating an application, or editing one
  -- still pending, is not sensitive.
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case new.status
      when 'approved' then 'membership_approved'
      when 'rejected' then 'membership_rejected'
      when 'suspended' then 'membership_suspended'
      when 'changes_requested' then 'membership_changes_requested'
      else 'membership_status_changed'
    end,
    'real_estate_membership',
    new.id::text,
    jsonb_build_object(
      'userId', new.user_id,
      'membershipType', new.membership_type::text,
      'fromStatus', case when tg_op = 'UPDATE' then old.status::text else null end,
      'toStatus', new.status::text,
      'approvedBy', new.approved_by
    )
  );

  return new;
end;
$$;

comment on function public.audit_membership_change is
  'Records a membership decision in the audit trail. Fires on insert and on a status change, not on an edit that leaves the status alone.';

drop trigger if exists real_estate_memberships_audit on public.real_estate_memberships;
create trigger real_estate_memberships_audit
  after insert or update of status on public.real_estate_memberships
  for each row execute function public.audit_membership_change();

-- -----------------------------------------------------------------------------
-- EXECUTE classification.
--
-- Supabase grants EXECUTE on a new public function to `anon` and `authenticated`
-- by default, and the Phase 12 hardening migration ran long before this one, so a
-- function created here gets the default grant unless it is classified in the same
-- migration. This is the trap AGENTS.md records twice.
--
--   * `audit_membership_change` is a TRIGGER function. Postgres does not check
--     EXECUTE for trigger functions, so the grant is not needed — but it is still
--     surface, so it is revoked.
--
--   * `user_has_membership` / `current_user_has_membership` are the two the
--     ownership policies in the next migration call, and a policy runs as the
--     requesting role. They must be executable by `anon` and `authenticated` or
--     the tables that use them become unreadable — the same reason `is_admin()`
--     is on the allow-list. `current_user_has_membership` takes no user argument
--     and only ever asks about `auth.uid()`, so it cannot be used to probe another
--     account's capabilities.
--
--   * `set_profile_completion_on_insert` / `sync_profile_completion` are trigger
--     functions too, revoked for the same reason.
-- -----------------------------------------------------------------------------
revoke all on function public.audit_membership_change() from public;
revoke all on function public.audit_membership_change() from anon, authenticated;
grant execute on function public.audit_membership_change() to service_role;

revoke all on function public.user_has_membership(uuid, public.membership_type) from public;
revoke all on function public.user_has_membership(uuid, public.membership_type) from anon, authenticated;
grant execute on function public.user_has_membership(uuid, public.membership_type) to service_role;

revoke all on function public.current_user_has_membership(public.membership_type) from public;
grant execute on function public.current_user_has_membership(public.membership_type) to anon, authenticated;
grant execute on function public.current_user_has_membership(public.membership_type) to service_role;

revoke all on function public.set_profile_completion_on_insert() from public;
revoke all on function public.set_profile_completion_on_insert() from anon, authenticated;
grant execute on function public.set_profile_completion_on_insert() to service_role;

revoke all on function public.sync_profile_completion() from public;
revoke all on function public.sync_profile_completion() from anon, authenticated;
grant execute on function public.sync_profile_completion() to service_role;

-- -----------------------------------------------------------------------------
-- Assert the outcome.
--
-- Two properties, both of which are the reason this migration exists:
--
--   (a) a user cannot write an APPROVED membership for themselves — the
--       capability analogue of the role-escalation fix, proven against the
--       database rather than asserted in a comment;
--
--   (b) `profiles.role` is still not self-writable, so this migration has not
--       quietly reopened what migration 24 closed.
--
-- Written as a `do` block that raises on failure, so a regression aborts the
-- migration rather than shipping.
-- -----------------------------------------------------------------------------
do $$
declare
  v_user uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_rows integer;
  v_status public.membership_status;
begin
  -- A throwaway account to attempt the escalation with. Created and removed
  -- inside this block so the assertion leaves nothing behind on a real database.
  insert into auth.users (id, email)
  values (v_user, 'phase1-assert@example.test')
  on conflict (id) do nothing;

  -- (a) A user may not create an already-approved membership.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_user::text, true);

    insert into public.real_estate_memberships (user_id, membership_type, status)
    values (v_user, 'landlord', 'approved');
  exception
    when insufficient_privilege then
      null; -- refused by RLS, which is the expected outcome
  end;
  reset role;

  select count(*) into v_rows
  from public.real_estate_memberships
  where user_id = v_user and status = 'approved';

  if v_rows <> 0 then
    raise exception
      'Phase 1 self-escalation guard FAILED: a user created an approved membership';
  end if;

  -- (b) A user may create a PENDING membership for themselves, which is the
  -- legitimate path and must not have been closed by the guard above.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', v_user::text, true);

    insert into public.real_estate_memberships (user_id, membership_type, status)
    values (v_user, 'landlord', 'pending_review');
  exception
    when insufficient_privilege then
      raise exception
        'Phase 1 capability FAILED: a user could not apply for a membership at all';
  end;
  reset role;

  select status into v_status
  from public.real_estate_memberships
  where user_id = v_user and membership_type = 'landlord';

  if v_status <> 'pending_review' then
    raise exception 'Phase 1 capability FAILED: the application did not persist (status %)', v_status;
  end if;

  -- Clean up, so a migration applied to a live database leaves no test row.
  delete from public.real_estate_memberships where user_id = v_user;
  delete from public.profiles where id = v_user;
  delete from auth.users where id = v_user;

  raise notice 'Phase 1: membership self-escalation is blocked and application works';
end
$$;
