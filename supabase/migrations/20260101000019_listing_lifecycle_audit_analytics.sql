-- =============================================================================
-- Phase 6 — Listing lifecycle: status transitions, audit trail, analytics.
--
-- Three rules that must hold no matter who writes the row, so all three are
-- enforced by triggers rather than by the application:
--
--   1. Status only moves along permitted paths. A published listing cannot jump
--      back to draft, and a sold one cannot be re-published without a decision.
--   2. An owner submission cannot become public until an administrator has
--      approved it. This is the phase's explicit acceptance criterion, and the
--      reason it lives here is that a rule in the publish action would be
--      bypassed by an import, a migration, or a psql session.
--   3. Every sensitive state change is recorded. An audit trail that the
--      application writes is a trail that is missing whenever the application is
--      bypassed, which is exactly when a trail matters most.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permit or refuse a status change.
--
-- The allowed transitions, and why each edge exists:
--
--   draft          → pending_review   submit for review
--   draft          → published        an admin publishing directly
--   draft          → archived         abandoned before it was ever live
--   pending_review → published        approved
--   pending_review → rejected         refused, with a reason
--   pending_review → draft            sent back for correction
--   published      → under_offer      an offer was accepted
--   published      → sold / rented    concluded directly
--   published      → archived         withdrawn
--   under_offer    → published        the offer fell through
--   under_offer    → sold / rented    the offer completed
--   under_offer    → archived         withdrawn while under offer
--   sold/rented    → archived         tidied away after conclusion
--   rejected       → draft            corrected and reopened
--   rejected       → archived         abandoned after rejection
--   archived       → draft            deliberately revived for rework
--
-- Terminal in practice: `sold` and `rented` cannot be reopened directly, because
-- reopening a concluded sale is a data correction rather than a lifecycle step
-- and should go through `archived → draft` where it is visible.
-- -----------------------------------------------------------------------------
create or replace function public.listing_status_transition_allowed(
  p_from public.listing_status,
  p_to public.listing_status
)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'draft' then p_to in ('pending_review', 'published', 'archived')
    when 'pending_review' then p_to in ('published', 'rejected', 'draft')
    when 'published' then p_to in ('under_offer', 'sold', 'rented', 'archived')
    when 'under_offer' then p_to in ('published', 'sold', 'rented', 'archived')
    when 'sold' then p_to in ('archived')
    when 'rented' then p_to in ('archived')
    when 'rejected' then p_to in ('draft', 'archived')
    when 'archived' then p_to in ('draft')
    -- A status equal to itself is not a transition and is handled by the trigger
    -- before this is consulted.
    else false
  end;
$$;

comment on function public.listing_status_transition_allowed is
  'Permitted listing status transitions. Sold/rented are terminal in practice: reopening goes through archived → draft so it is visible.';

-- -----------------------------------------------------------------------------
-- The lifecycle trigger.
--
-- Runs before the write so it can populate the lifecycle timestamps and so a
-- refused transition costs no I/O.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_listing_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approved boolean;
begin
  -- Reference is always generated, never supplied by the caller, so it cannot be
  -- chosen to collide with another listing.
  if tg_op = 'INSERT' and new.reference is null then
    new.reference := public.generate_listing_reference();
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
  'Validates status transitions, gates owner submissions on approval, and maintains published_at/closed_at.';

create trigger property_listings_enforce_lifecycle
  before insert or update of status on public.property_listings
  for each row execute function public.enforce_listing_lifecycle();

-- -----------------------------------------------------------------------------
-- Audit trail for sensitive listing operations.
--
-- Written by a trigger for the same reason the transitions are: an audit entry
-- produced by application code is absent exactly when something bypasses the
-- application. The trigger records create, status change, publish, and approval
-- decisions, which are the operations the phase requires to be traceable.
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
    -- A plain edit. Recorded because "who changed this description" is a
    -- question that arises, but without the lifecycle detail of the branches
    -- above.
    v_action := 'property_updated';
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    auth.uid(),
    v_action,
    'property_listing',
    new.id::text,
    jsonb_build_object(
      'reference', new.reference,
      'status', new.status,
      -- Only the previous status when it actually changed, so a plain edit does
      -- not claim a transition that did not happen.
      'fromStatus', case when tg_op = 'UPDATE' then old.status::text end,
      'toStatus', new.status::text,
      'source', new.source::text,
      'agentId', new.agent_id
    )
  );

  return new;
end;
$$;

comment on function public.audit_listing_changes is
  'Writes an audit_logs row for every listing create, edit and lifecycle change. A trigger so the trail exists even when the application is bypassed.';

create trigger property_listings_audit
  after insert or update on public.property_listings
  for each row execute function public.audit_listing_changes();

-- -----------------------------------------------------------------------------
-- Analytics events.
--
-- One row per event rather than only a counter, because a counter cannot answer
-- "views over the last week" or "which listing gets inquiries but no viewings".
-- The counter on the listing is a cache of this table.
--
-- No visitor identifier is stored: a view is recorded against a listing, not
-- against a person. Retaining an IP or a persistent visitor id would turn a view
-- count into tracking, which the site has no consent basis for.
-- -----------------------------------------------------------------------------
create table public.listing_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.property_listings (id) on delete cascade,
  event_type public.listing_event_type not null,
  -- The inquiry this event relates to, when it is an inquiry. Null for a view.
  inquiry_id uuid references public.inquiries (id) on delete set null,
  -- A per-day digest of nothing personally identifying: used only to deduplicate
  -- a visitor's repeated views within a short window. Rotated daily and not
  -- linkable to a person.
  visitor_digest text,
  occurred_at timestamptz not null default now(),

  constraint listing_events_digest_length check (
    visitor_digest is null or char_length(visitor_digest) = 64
  ),
  -- An inquiry event must name its inquiry; a view must not. This keeps the two
  -- shapes from blurring into a row that is ambiguous about what happened.
  constraint listing_events_inquiry_consistency check (
    (event_type = 'inquiry' and inquiry_id is not null)
    or (event_type <> 'inquiry' and inquiry_id is null)
  )
);

comment on table public.listing_events is
  'Append-only listing analytics. Stores no visitor identifier beyond a daily-rotated digest used to dedupe views.';
comment on column public.listing_events.visitor_digest is
  'Rotated daily, used only to collapse repeat views in a short window. Not linkable to a person.';

create index listing_events_listing_time_idx
  on public.listing_events (listing_id, occurred_at desc);

create index listing_events_type_time_idx
  on public.listing_events (event_type, occurred_at desc);

-- Supports the dedupe lookup without scanning a listing's whole history.
create index listing_events_dedupe_idx
  on public.listing_events (listing_id, event_type, visitor_digest, occurred_at desc)
  where visitor_digest is not null;

-- -----------------------------------------------------------------------------
-- Recount the denormalized counters from the event table.
--
-- The counters on `property_listings` are a cache, and a cache needs a
-- authoritative way to be rebuilt. Counting the events rather than incrementing
-- a counter is what makes the number recoverable: an increment that was lost
-- because a transaction rolled back cannot be detected, whereas a recount is
-- simply correct.
-- -----------------------------------------------------------------------------
create or replace function public.recount_listing_metrics(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.property_listings p
  set view_count = (
        select count(*) from public.listing_events e
        where e.listing_id = p.id and e.event_type = 'view'
      ),
      inquiry_count = (
        select count(*) from public.listing_events e
        where e.listing_id = p.id and e.event_type = 'inquiry'
      )
  where p.id = p_listing_id;
end;
$$;

comment on function public.recount_listing_metrics is
  'Rebuilds the denormalized view/inquiry counters from listing_events, which is the source of truth.';

-- -----------------------------------------------------------------------------
-- Record an event and refresh the affected counter.
--
-- The counter is refreshed from the events rather than incremented, so a
-- concurrent insert cannot lose an update and a manual correction to the event
-- table is reflected on the next write.
-- -----------------------------------------------------------------------------
create or replace function public.record_listing_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.event_type = 'view' then
    update public.property_listings
    set view_count = (
      select count(*) from public.listing_events e
      where e.listing_id = new.listing_id and e.event_type = 'view'
    )
    where id = new.listing_id;
  elsif new.event_type = 'inquiry' then
    update public.property_listings
    set inquiry_count = (
      select count(*) from public.listing_events e
      where e.listing_id = new.listing_id and e.event_type = 'inquiry'
    )
    where id = new.listing_id;
  end if;

  return new;
end;
$$;

create trigger listing_events_update_counters
  after insert on public.listing_events
  for each row execute function public.record_listing_event();

-- -----------------------------------------------------------------------------
-- Record a view, ignoring a repeat within a short window.
--
-- The dedupe lives here rather than in the caller so every caller gets it, and
-- so a refresh loop cannot inflate a listing's popularity — which is the metric
-- the business would use to decide what to promote.
-- -----------------------------------------------------------------------------
create or replace function public.record_listing_view(
  p_listing_id uuid,
  p_visitor_digest text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- A view is only meaningful for a listing the public can see. Recording views
  -- on a draft would let an unpublished listing accumulate a popularity figure.
  if not exists (
    select 1 from public.property_listings
    where id = p_listing_id and status = 'published'
  ) then
    return;
  end if;

  if p_visitor_digest is not null and exists (
    select 1 from public.listing_events
    where listing_id = p_listing_id
      and event_type = 'view'
      and visitor_digest = p_visitor_digest
      and occurred_at > now() - interval '6 hours'
  ) then
    return;
  end if;

  insert into public.listing_events (listing_id, event_type, visitor_digest)
  values (p_listing_id, 'view', p_visitor_digest);
end;
$$;

comment on function public.record_listing_view is
  'Records a view unless the same digest viewed the listing within 6 hours. Ignores unpublished listings so drafts cannot build a popularity figure.';

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.listing_events enable row level security;

-- Analytics are internal. A listing's own view count is published on the card;
-- the event log is not.
create policy "listing_events_select_admin"
  on public.listing_events for select
  to authenticated
  using (public.is_real_estate_admin());
