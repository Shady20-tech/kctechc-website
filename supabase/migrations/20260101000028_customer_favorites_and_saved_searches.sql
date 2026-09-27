-- =============================================================================
-- Phase 7 — Customer favourites, saved searches and alert preferences.
--
-- Requirement: "Add saved favorites for registered customers if Phase 1 role
-- model supports it" and "Add saved searches and alert-preference schema if
-- implemented, but do not create a notification service that silently fails."
--
-- The Phase 1 role model supports this: `customer` is a real role and the
-- `authenticated` role is distinct from `anon`. So favourites are a per-user
-- table keyed on `auth.uid()`, and every policy below is written `to
-- authenticated` with `auth.uid() = user_id` in both `using` and `with check`.
-- The `with check` is what stops a user from inserting a row under someone
-- else's id; `using` alone would only govern what they can read.
--
-- The alert-preference table is deliberately a *preference* store and nothing
-- more. There is no sender, no queue and no cron entry in this migration, because
-- the brief forbids a notification service that silently fails: a scheduled job
-- that cannot deliver mail would record "alerts sent" against searches nobody was
-- told about. What exists is the durable record of what a customer asked for, so
-- a delivery worker can be added later as an explicit, testable piece of work
-- rather than as a stub that pretends to have run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Favourites.
--
-- A join table between a user and a listing, with the unique constraint doing the
-- work: saving twice is an upsert rather than a duplicate row, so the toggle in
-- the UI does not have to check first. The FK cascades on listing deletion so a
-- withdrawn listing does not leave a dangling favourite that renders as a broken
-- card.
-- -----------------------------------------------------------------------------
create table public.listing_favorites (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.property_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint listing_favorites_unique unique (user_id, listing_id)
);

comment on table public.listing_favorites is
  'A registered customer''s saved properties. One row per (user, listing).';

-- The list page reads one user's favourites newest first; this index serves both
-- the lookup and the ordering.
create index listing_favorites_user_idx
  on public.listing_favorites (user_id, created_at desc);

-- The "is this listing favourited?" check runs per card on a search page, so it
-- is looked up by listing as well.
create index listing_favorites_listing_idx
  on public.listing_favorites (listing_id);

alter table public.listing_favorites enable row level security;

-- A customer sees only their own favourites. There is no public or anonymous
-- policy: a favourite is private to the person who saved it.
create policy "listing_favorites_select_own"
  on public.listing_favorites for select
  to authenticated
  using (auth.uid() = user_id);

create policy "listing_favorites_insert_own"
  on public.listing_favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "listing_favorites_delete_own"
  on public.listing_favorites for delete
  to authenticated
  using (auth.uid() = user_id);

-- No update policy. A favourite has no mutable field: changing which listing it
-- points at is a different favourite, expressed as a delete and an insert.

-- -----------------------------------------------------------------------------
-- Saved searches.
--
-- The filter state is stored as the exact query string the browser was on,
-- because that is what makes the search reproducible: the URL already is the
-- canonical serialization of a filter state (`buildListingQuery` guarantees one
-- state to one URL), so re-parsing it cannot drift from what the customer saw.
-- Storing decomposed columns instead would create a second representation that
-- has to be kept in step with the parser forever.
--
-- `locale` is stored because the same filter state is a different set of results
-- in French — the searchable text is localized.
-- -----------------------------------------------------------------------------
create table public.saved_searches (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A name the customer recognises. Required: a list of unnamed URLs is not
  -- usable, and a generated name ("Search 3") is worse than asking.
  label text not null,
  -- The canonical query string, without the leading '?'. Empty is valid and
  -- means "everything" — a saved search with no filters is still a real thing to
  -- save if the customer wants a bookmark with an alert on it.
  query_string text not null default '',
  locale public.locale_code not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_searches_label_length check (
    char_length(label) between 1 and 120
  ),
  constraint saved_searches_query_length check (
    char_length(query_string) <= 2000
  ),
  -- One customer cannot save the same label twice; that is almost always a
  -- double-submit rather than an intent to keep two identical names.
  constraint saved_searches_unique_label unique (user_id, label)
);

comment on table public.saved_searches is
  'A customer''s saved property-search filter states, stored as the canonical query string.';

create index saved_searches_user_idx
  on public.saved_searches (user_id, created_at desc);

create trigger saved_searches_set_updated_at
  before update on public.saved_searches
  for each row execute function public.set_updated_at();

alter table public.saved_searches enable row level security;

create policy "saved_searches_select_own"
  on public.saved_searches for select
  to authenticated
  using (auth.uid() = user_id);

create policy "saved_searches_insert_own"
  on public.saved_searches for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "saved_searches_update_own"
  on public.saved_searches for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_searches_delete_own"
  on public.saved_searches for delete
  to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Alert preferences.
--
-- One row per saved search at most, holding *whether* and *how often* the
-- customer wants to hear about new matches. Nothing here sends anything.
--
-- `enabled` defaults to false rather than true on purpose: an alert that starts
-- sending the moment a search is saved is a subscription the customer did not
-- knowingly make. Opting in is an explicit act.
--
-- There is no `last_sent_at` or `sent_count` column. Those belong to a delivery
-- worker that does not exist, and adding them now would let a future reader
-- believe alerts have been going out. The absence is the honest state.
-- -----------------------------------------------------------------------------
create type public.search_alert_frequency as enum (
  'instant',
  'daily',
  'weekly'
);

create table public.search_alert_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  saved_search_id uuid not null unique
    references public.saved_searches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  frequency public.search_alert_frequency not null default 'daily',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.search_alert_preferences is
  'Whether a saved search should alert, and how often. Preferences only — no delivery worker reads this yet.';

create index search_alert_preferences_user_idx
  on public.search_alert_preferences (user_id);

create trigger search_alert_preferences_set_updated_at
  before update on public.search_alert_preferences
  for each row execute function public.set_updated_at();

alter table public.search_alert_preferences enable row level security;

create policy "search_alert_preferences_select_own"
  on public.search_alert_preferences for select
  to authenticated
  using (auth.uid() = user_id);

-- The insert policy checks the *parent* search is the caller's, not just that the
-- preference row carries their id. Without the `exists` clause a customer could
-- attach an alert preference to another customer's saved search id — the row
-- would be theirs, but the relationship would be to someone else's data.
create policy "search_alert_preferences_insert_own"
  on public.search_alert_preferences for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.saved_searches s
      where s.id = saved_search_id and s.user_id = auth.uid()
    )
  );

create policy "search_alert_preferences_update_own"
  on public.search_alert_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.saved_searches s
      where s.id = saved_search_id and s.user_id = auth.uid()
    )
  );

create policy "search_alert_preferences_delete_own"
  on public.search_alert_preferences for delete
  to authenticated
  using (auth.uid() = user_id);
