-- =============================================================================
-- Phase 6 — Listing media with ordering, and the owner submission approval queue.
--
-- Media is straightforward: an ordered gallery with required alt text, on the
-- same pattern as project and product media.
--
-- The submission queue is the interesting half. The phase requires that an owner
-- can propose a property, that an administrator approves it, and that nothing is
-- public until that happens. Two designs were possible:
--
--   (a) The owner writes a `property_listings` row with `status = 'draft'` and a
--       submission row points at it.
--   (b) The owner writes only to a submission table, and approval creates the
--       listing.
--
-- (a) is used here, because the owner's submitted content and the eventual
-- listing are the same content: the administrator's job is to review and correct
-- a property, not to retype it. Splitting them into two shapes would mean
-- writing every field twice and keeping the two in step by hand.
--
-- The safety this needs is that a listing carrying an owner's content can never
-- be public before approval. That is enforced in the database by
-- `enforce_listing_lifecycle` (migration 19), which refuses any public status on
-- a `source = 'owner_submission'` listing that has no approved review. So
-- design (a) carries no more risk than (b) while avoiding the duplication.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Listing media.
--
-- Alt text is NOT NULL for the same reason as every other image in this project:
-- an image without alternative text is inaccessible, and making the field
-- optional is precisely how it ends up empty.
-- -----------------------------------------------------------------------------
create table public.listing_media (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.property_listings (id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  caption text,
  -- The gallery order. Explicit rather than implied by insertion order, because
  -- a gallery is reordered by hand and a reorder must not depend on row ids.
  position integer not null default 0,
  -- Exactly one primary image per listing, enforced by a partial unique index
  -- below. The card and the social preview both read it.
  is_primary boolean not null default false,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint listing_media_path_format check (
    storage_path ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$'
    and storage_path !~ '\.\.'
    and storage_path !~ '^/'
  ),
  constraint listing_media_alt_length check (
    char_length(alt_text) between 1 and 300
  ),
  constraint listing_media_caption_length check (
    caption is null or char_length(caption) between 1 and 400
  ),
  constraint listing_media_dimensions_positive check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint listing_media_position_non_negative check (position >= 0),
  constraint listing_media_unique_path unique (listing_id, storage_path)
);

comment on table public.listing_media is
  'Ordered listing gallery. Alt text is required; the primary image is unique per listing.';

create index listing_media_listing_idx
  on public.listing_media (listing_id, position);

-- One primary image per listing. Without this, two rows could both claim to be
-- primary and the card's image would depend on row order.
create unique index listing_media_one_primary_idx
  on public.listing_media (listing_id)
  where is_primary;

create trigger listing_media_set_updated_at
  before update on public.listing_media
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Owner/agent submissions.
--
-- The queue an administrator works. One row per submitted listing, carrying the
-- review decision and its reason. `reviewed_by` and `reviewed_at` are the
-- evidence the lifecycle trigger looks for before allowing publication, so an
-- approval cannot be implied — it has to be recorded.
-- -----------------------------------------------------------------------------
create table public.listing_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.property_listings (id) on delete cascade,

  status public.submission_status not null default 'pending_review',

  -- Who submitted. Either an agent (with an account) or an owner (without one).
  submitted_by uuid references auth.users (id) on delete set null,
  -- The owner's stated contact details, kept here as submitted. This is the
  -- record of what was claimed; `listing_private_details` is the verified
  -- record the team maintains.
  submitter_name text not null,
  submitter_email extensions.citext,
  submitter_phone text,
  -- Free text: an owner may want to explain something the form does not ask.
  notes text,

  -- The review decision.
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  -- Why it was rejected or sent back. Required for those outcomes so a refusal
  -- cannot be recorded without a reason the owner could act on.
  review_notes text,

  -- Where the submission came from, for abuse handling. A hash, never the raw
  -- address, matching how inquiries record provenance.
  ip_hash text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint listing_submissions_submitter_name_length check (
    char_length(submitter_name) between 2 and 200
  ),
  constraint listing_submissions_submitter_email_length check (
    submitter_email is null or char_length(submitter_email::text) <= 254
  ),
  constraint listing_submissions_submitter_phone_length check (
    submitter_phone is null or char_length(submitter_phone) between 5 and 40
  ),
  constraint listing_submissions_notes_length check (
    notes is null or char_length(notes) <= 4000
  ),
  constraint listing_submissions_review_notes_length check (
    review_notes is null or char_length(review_notes) between 1 and 4000
  ),
  -- A decided submission must record who decided it and when. Without this a
  -- row could be marked approved with no reviewer, and the lifecycle trigger
  -- would then be satisfied by a decision nobody made.
  constraint listing_submissions_decision_requires_reviewer check (
    status = 'pending_review'
    or (reviewed_by is not null and reviewed_at is not null)
  ),
  -- A refusal must carry its reason.
  constraint listing_submissions_rejection_requires_notes check (
    status not in ('rejected', 'changes_requested')
    or (review_notes is not null and btrim(review_notes) <> '')
  )
);

comment on table public.listing_submissions is
  'Owner/agent property submissions and their review decision. Approval is what lets an owner-submitted listing become public.';

create index listing_submissions_queue_idx
  on public.listing_submissions (status, created_at)
  where status = 'pending_review';

create index listing_submissions_listing_idx
  on public.listing_submissions (listing_id);

create trigger listing_submissions_set_updated_at
  before update on public.listing_submissions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Record the review decision in the audit trail.
--
-- A trigger, so an approval recorded by any path leaves the same evidence. The
-- actor is `auth.uid()`, which is the administrator making the decision, not the
-- submitter.
-- -----------------------------------------------------------------------------
create or replace function public.audit_submission_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only a decision is audited. Creating or editing a pending submission is not
  -- a sensitive operation.
  if new.status = old.status then
    return new;
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    auth.uid(),
    case new.status
      when 'approved' then 'property_approved'
      when 'rejected' then 'property_rejected'
      else 'property_submission_status_changed'
    end,
    'listing_submission',
    new.id::text,
    jsonb_build_object(
      'listingId', new.listing_id,
      'fromStatus', old.status::text,
      'toStatus', new.status::text,
      'submittedBy', new.submitted_by,
      'reviewedBy', new.reviewed_by
    )
  );

  return new;
end;
$$;

comment on function public.audit_submission_decision is
  'Audits a submission review decision. Records the reviewing administrator, not the submitter.';

create trigger listing_submissions_audit
  after update of status on public.listing_submissions
  for each row execute function public.audit_submission_decision();

-- -----------------------------------------------------------------------------
-- Approve or reject a submission.
--
-- Wrapped in a function so the two writes that must agree — the review row and
-- the listing's status — happen in one transaction. An administrator who could
-- approve the review but not publish the listing would leave a listing that
-- looks approved and is not live.
--
-- `p_publish` lets an approval keep the listing unpublished, which is the honest
-- default for content that still needs work: approval of the submission is not
-- the same decision as readiness to publish.
-- -----------------------------------------------------------------------------
create or replace function public.review_listing_submission(
  p_submission_id uuid,
  p_decision public.submission_status,
  p_review_notes text default null,
  p_publish boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.listing_submissions;
  v_listing public.property_listings;
begin
  select * into v_submission
  from public.listing_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Unknown submission %', p_submission_id
      using errcode = 'no_data_found';
  end if;

  if v_submission.status <> 'pending_review' then
    raise exception 'Submission % has already been decided (%)',
      p_submission_id, v_submission.status
      using errcode = 'check_violation';
  end if;

  if p_decision = 'pending_review' then
    raise exception 'A review must reach a decision'
      using errcode = 'check_violation';
  end if;

  update public.listing_submissions
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = p_review_notes
  where id = p_submission_id;

  select * into v_listing
  from public.property_listings
  where id = v_submission.listing_id
  for update;

  -- Publishing is attempted only after the approval row is written, because the
  -- lifecycle trigger reads that row to decide whether publication is permitted.
  if p_publish and p_decision = 'approved' and v_listing.status = 'draft' then
    update public.property_listings
    set status = 'published'
    where id = v_listing.id;
  end if;

  -- A refusal or a request for changes returns the listing to draft so it leaves
  -- the review queue and cannot linger in a state that implies it is being
  -- considered.
  if p_decision in ('rejected', 'changes_requested')
     and v_listing.status = 'pending_review' then
    update public.property_listings
    set status = 'draft'
    where id = v_listing.id;
  end if;
end;
$$;

comment on function public.review_listing_submission is
  'Records a review decision and, when approving, publishes the listing in the same transaction. Approval and publication are separate decisions: p_publish defaults to false.';

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.listing_media enable row level security;
alter table public.listing_submissions enable row level security;

-- Media is public only where the listing it belongs to is public. This is the
-- same boundary as project and product media: an image attached to a draft is
-- not readable anonymously.
create policy "listing_media_select_public"
  on public.listing_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id
        and p.status in ('published', 'under_offer', 'sold', 'rented')
    )
  );

create policy "listing_media_select_admin"
  on public.listing_media for select
  to authenticated
  using (public.is_real_estate_admin());

-- An agent may manage media on their own listings only.
create policy "listing_media_write_agent"
  on public.listing_media for all
  to authenticated
  using (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id and p.agent_id = public.current_agent_id()
    )
  )
  with check (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id and p.agent_id = public.current_agent_id()
    )
  );

create policy "listing_media_write_admin"
  on public.listing_media for all
  to authenticated
  using (public.is_real_estate_admin())
  with check (public.is_real_estate_admin());

-- Submissions are internal. There is deliberately no anonymous read: an owner
-- has no account to read with, and the queue is not public.
create policy "listing_submissions_select_admin"
  on public.listing_submissions for select
  to authenticated
  using (public.is_real_estate_admin());

-- A signed-in agent may read and create submissions for their own listings.
create policy "listing_submissions_select_own"
  on public.listing_submissions for select
  to authenticated
  using (submitted_by = auth.uid());

create policy "listing_submissions_insert_own"
  on public.listing_submissions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.property_listings p
      where p.id = listing_id and p.agent_id = public.current_agent_id()
    )
  );

create policy "listing_submissions_write_admin"
  on public.listing_submissions for all
  to authenticated
  using (public.is_real_estate_admin())
  with check (public.is_real_estate_admin());
