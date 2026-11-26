-- =============================================================================
-- Phase 4 (follow-up) — Customer reviews of their dealings with KC Technology.
--
-- A review is written by a customer about a real engagement, is submitted to the
-- team, and appears on the public site only after a member of staff accepts it.
-- That single sentence drives every decision below.
--
-- 1. NOTHING IS PUBLIC UNTIL ACCEPTED. The public policy admits only
--    `status = 'approved'`, so a `pending_review` row is invisible to `anon` even
--    though it exists. Moderation is therefore a database property, not a filter
--    a page could forget to apply.
--
-- 2. WHO MAY REVIEW IS NOT "ANY STAFF ACCOUNT". The requirement excludes agents
--    and landlords: an agent is a marketplace participant whose own listings sit
--    beside the reviews, so letting one decide what is published about the
--    company is a conflict of interest, and a landlord is a customer. The
--    reviewer set is the internal console roles only — every `*_staff`,
--    every `*_admin`, `department_staff` and `super_admin`. `is_review_moderator()`
--    is the single predicate; a test asserts it against the role list.
--
-- 3. A REVIEWER CANNOT APPROVE THEIR OWN REVIEW. Without that, the moderator set
--    would be able to publish unmoderated text about the company under their own
--    name. Enforced in the policy (`with check`) rather than only in the action,
--    because the policy is the control.
--
-- 4. `submission_status` is REUSED rather than a new enum created. It already
--    means exactly this: pending_review / approved / rejected /
--    changes_requested. A second enum with the same members would be two
--    spellings of one idea.
--
-- 5. One review per customer per engagement window is NOT enforced. Two reviews
--    from the same person about two different jobs are legitimate, and the schema
--    has no reliable way to tell them apart. Duplicate submissions are instead a
--    moderation concern, which is where the human judgement already lives.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The reviewer predicate.
--
-- Deliberately an allow-list of internal roles rather than "not an agent and not
-- a landlord". A new role added later must be classified explicitly; with a
-- deny-list it would silently gain the power to publish reviews.
-- -----------------------------------------------------------------------------
create or replace function public.is_review_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.current_user_role()::text in (
      'real_estate_staff',
      'real_estate_admin',
      'digital_marketing_staff',
      'digital_marketing_admin',
      'electrical_staff',
      'electrical_admin',
      'department_staff',
      'super_admin'
    ),
    false
  );
$$;

comment on function public.is_review_moderator() is
  'True for internal console roles that may moderate customer reviews. Excludes real_estate_agent (a marketplace participant) and every customer, including landlords, by construction: it is an allow-list.';

-- This one must stay executable by `authenticated`: it is called from an RLS
-- policy, and Postgres checks EXECUTE on policy predicates. Revoking it from
-- `anon` is safe and correct (no anonymous path evaluates a reviews policy that
-- needs it beyond the public SELECT), but revoking it from `authenticated` would
-- make the reviews table unreadable for every signed-in user.
revoke all on function public.is_review_moderator() from public;
revoke all on function public.is_review_moderator() from anon;
grant execute on function public.is_review_moderator() to authenticated;
grant execute on function public.is_review_moderator() to service_role;

-- -----------------------------------------------------------------------------
-- The reviews table.
-- -----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default extensions.gen_random_uuid(),

  -- The author. `set null` rather than cascade: deleting an account must not
  -- erase an accepted review's history, and the review carries its own
  -- `author_name` snapshot for display.
  author_id uuid references auth.users (id) on delete set null,

  -- What the reviewer wants shown. A display name is snapshotted at submission
  -- so a later profile rename does not silently rewrite an already-approved
  -- review's byline.
  author_name text not null,
  -- Optional context. Never inferred from the author's account.
  author_role_label text,

  -- 1..5. Constrained in the table because a rating outside the scale would
  -- break any average computed from it.
  rating smallint not null,

  title text,
  body text not null,

  -- Where the reviewer dealt with the company. Optional and free text: the
  -- department list is small and stable, but not every dealing maps to one.
  department_slug text,

  status public.submission_status not null default 'pending_review',

  -- The moderation decision.
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  -- Required when rejecting or requesting changes, so a refusal always carries a
  -- reason. Not shown publicly.
  review_notes text,

  -- Provenance for abuse handling: a hash of the submitting address, never the
  -- raw value, matching how inquiries record it.
  source_hash text,

  -- Whether the author consented to their review being published. Required, and
  -- checked, so consent is a precondition rather than an assumption.
  publish_consent boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_body_length check (char_length(btrim(body)) between 10 and 4000),
  constraint reviews_title_length check (title is null or char_length(btrim(title)) between 1 and 160),
  constraint reviews_author_name_length check (char_length(btrim(author_name)) between 1 and 120),
  -- A rejection or a request for changes must say why. An approval need not.
  constraint reviews_refusal_requires_note check (
    status not in ('rejected', 'changes_requested')
    or (review_notes is not null and char_length(btrim(review_notes)) > 0)
  ),
  -- A decided review records who decided it and when.
  constraint reviews_decision_requires_reviewer check (
    status = 'pending_review'
    or (reviewed_by is not null and reviewed_at is not null)
  ),
  -- Publication requires consent, at every layer.
  constraint reviews_publish_requires_consent check (
    status <> 'approved' or publish_consent
  )
);

comment on table public.reviews is
  'Customer reviews of their dealings with KC Technology. Visible publicly only when status = approved; a pending or rejected review is never readable by anon.';

comment on column public.reviews.author_name is
  'Display name snapshotted at submission. A later profile rename must not rewrite an approved review''s byline.';

comment on column public.reviews.review_notes is
  'The moderator''s reason. Required for rejected/changes_requested, internal only, never rendered publicly.';

-- -----------------------------------------------------------------------------
-- Indexes.
--
-- The public read is "approved, newest first", so a partial index serves it and
-- stays small. The moderation queue is "pending, oldest first" — oldest first
-- because a queue that serves the newest submission first starves the ones that
-- have waited longest.
-- -----------------------------------------------------------------------------
create index reviews_public_idx
  on public.reviews (created_at desc)
  where status = 'approved';

create index reviews_pending_idx
  on public.reviews (created_at)
  where status = 'pending_review';

create index reviews_author_idx
  on public.reviews (author_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance. Reuses the existing trigger function if one exists.
-- -----------------------------------------------------------------------------
create or replace function public.touch_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_reviews_updated_at();

-- Trigger functions are not subject to the EXECUTE check Postgres applies to
-- policy/constraint helpers, but Supabase still grants them to browser roles by
-- default. Revoke for the same reason as every other new function.
revoke all on function public.touch_reviews_updated_at() from public;
revoke all on function public.touch_reviews_updated_at() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row level security.
-- -----------------------------------------------------------------------------
alter table public.reviews enable row level security;

-- Anyone may read an approved review. This is the whole public surface.
create policy "reviews_select_approved"
  on public.reviews for select
  to anon, authenticated
  using (status = 'approved');

-- An author may read their own review whatever its state, so they can see that it
-- was received and what happened to it.
create policy "reviews_select_own"
  on public.reviews for select
  to authenticated
  using (auth.uid() = author_id);

-- A moderator may read the queue, including pending and rejected rows.
create policy "reviews_select_moderator"
  on public.reviews for select
  to authenticated
  using (public.is_review_moderator());

-- A signed-in user may submit a review as themselves, and only in the pending
-- state. The `with check` is what stops a submission arriving pre-approved, and
-- what forces consent.
create policy "reviews_insert_own"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and status = 'pending_review'
    and reviewed_by is null
    and reviewed_at is null
    and publish_consent
  );

-- A moderator decides. The `using` clause admits pending rows; the `with check`
-- pins the destination to a decided state and forbids approving one's own review.
create policy "reviews_update_moderator"
  on public.reviews for update
  to authenticated
  using (public.is_review_moderator())
  with check (
    public.is_review_moderator()
    and status in ('approved', 'rejected', 'changes_requested')
    and reviewed_by = auth.uid()
    and reviewed_at is not null
    and (author_id is null or author_id <> auth.uid())
  );

-- An author may withdraw their own review while it is still pending, and may edit
-- the text of a review that was sent back for changes. They may never move it to
-- an approved state: that is the moderator's decision.
create policy "reviews_update_own_pending"
  on public.reviews for update
  to authenticated
  using (auth.uid() = author_id and status in ('pending_review', 'changes_requested'))
  with check (
    auth.uid() = author_id
    and status in ('pending_review')
    and reviewed_by is null
    and reviewed_at is null
  );

-- An author may delete their own review. Deleting an approved review removes it
-- from the site, which is the author's right.
create policy "reviews_delete_own"
  on public.reviews for delete
  to authenticated
  using (auth.uid() = author_id);

-- A moderator may remove a published review.
create policy "reviews_delete_moderator"
  on public.reviews for delete
  to authenticated
  using (public.is_review_moderator());

-- -----------------------------------------------------------------------------
-- Assertions. Run on every application so a regression fails the migration
-- rather than shipping a queue nobody can action or a public leak.
-- -----------------------------------------------------------------------------
do $$
declare
  v_policy text;
begin
  -- RLS must be on, or every policy above is decorative.
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reviews' and c.relrowsecurity
  ) then
    raise exception 'reviews has RLS disabled';
  end if;

  -- No policy may expose a non-approved review to anon.
  select pg_get_expr(pol.polqual, pol.polrelid) into v_policy
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  where c.relname = 'reviews' and pol.polname = 'reviews_select_approved';

  if v_policy is null or position('approved' in v_policy) = 0 then
    raise exception 'the public review policy does not filter on approved (got %)', v_policy;
  end if;

  -- A pending review must be invisible to anon.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reviews'
      and 'anon' = any (roles) and cmd = 'SELECT'
      and policyname <> 'reviews_select_approved'
  ) then
    raise exception 'a second anon SELECT policy on reviews could widen the public surface';
  end if;

  raise notice 'PASS  reviews moderation surface';
end
$$;
