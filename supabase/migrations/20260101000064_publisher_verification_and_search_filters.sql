-- =============================================================================
-- Phase 4 — Publisher verification badges, and the marketplace search filters.
--
-- Two things the marketplace redesign needs from the database, kept in one
-- migration because they are one story: a visitor must be able to filter to
-- properties posted by a *verified* landlord or agent, and the price filter must
-- compare like with like.
--
-- ## 1. A verification badge is a claim about identity, so it is written by hand
--
-- The brief is explicit: "Only display verified status for users whose KYC
-- membership has actually been approved and remains active. Never mark every
-- account as verified." A KYC approval already means "we reviewed this person's
-- identity". A verification badge is a second, stronger statement — a public
-- trust mark — and it must be granted deliberately by a super admin, not inferred
-- from an approval.
--
-- So `verified_at` / `verified_by` are new columns on `real_estate_memberships`,
-- written by a super admin and by nothing else:
--
--   * A BEFORE trigger refuses any change to the pair unless the caller is a
--     super admin (`is_super_admin()`) or a trusted context (`auth.uid() is
--     null` — service role, psql, a migration, the validation harness). The
--     `real_estate_memberships_write_staff` RLS policy grants every real-estate
--     administrator a row write, so without this trigger a plain administrator
--     could set the badge through PostgREST. The policy is row-level and cannot
--     express "this column, for this role", so the guard is a trigger — the same
--     shape as `forbid_self_role_change` and `enforce_listing_lifecycle`.
--
--   * The badge is a property of an ACTIVE capability. A membership that leaves
--     `approved` (suspended, rejected, sent back) has its verification cleared by
--     the same trigger, so a suspended member does not keep a public trust mark.
--     The predicate also requires `status = 'approved'`, so the two cannot
--     disagree even if the column were set directly in a trusted context.
--
-- ## 2. `property_listings.publisher_verified` is denormalized on purpose
--
-- The public search reads `property_listings` directly through PostgREST, which
-- cannot express an `exists` subquery. A generated column cannot be used either,
-- because it may only reference the current row. So the flag is a real boolean
-- column maintained by triggers:
--
--   * on a listing write, from its poster;
--   * on a membership verification change, for every listing that poster holds.
--
-- The alternative — computing it in the RPC only — would leave the card unable to
-- show the badge, because the card is rendered from the table row, not from the
-- RPC's ranking projection.
--
-- ## 3. Currency
--
-- Prices are stored per listing with their own currency, and there is no exchange
-- rate feed. Comparing a XAF price to a NGN price as though the numbers were
-- equivalent is exactly what the brief forbids, so the price filter gains a
-- currency and compares within it. The application always sends the currency
-- alongside a price bound (defaulting to XAF, the primary Cameroon currency).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Verification columns on the capability row.
-- -----------------------------------------------------------------------------
alter table public.real_estate_memberships
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users (id) on delete set null;

comment on column public.real_estate_memberships.verified_at is
  'When a super admin granted this member a public verification badge. Null means no badge. Only a super admin may set it, and it is cleared when the membership leaves approved.';
comment on column public.real_estate_memberships.verified_by is
  'The super admin who granted the badge. on delete set null, so removing the reviewer does not destroy the record.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'real_estate_memberships_verification_consistent'
  ) then
    alter table public.real_estate_memberships
      add constraint real_estate_memberships_verification_consistent check (
        (verified_at is null and verified_by is null)
        or (verified_at is not null and verified_by is not null)
      );
  end if;
end
$$;

-- The badge is only meaningful on a live capability. A CHECK cannot clear the
-- columns, so this is enforced by the BEFORE trigger below; the constraint above
-- only keeps the pair internally consistent.
comment on constraint real_estate_memberships_verification_consistent
  on public.real_estate_memberships is
  'A verification badge always records who granted it and when. The "approved only" rule is enforced by enforce_membership_verification.';

-- -----------------------------------------------------------------------------
-- 2. The verified-publisher predicate.
--
-- The poster of a listing is its agent's user when the listing is managed by an
-- agent, and the owner otherwise. `coalesce(agent.user_id, owner_id)` expresses
-- exactly that: an agent-managed listing is attributed to the agent when the
-- agent has an account, and to the owner when it does not.
--
-- SECURITY DEFINER so the triggers below can read the membership table without
-- recursing through its own RLS, with a pinned search_path. It is revoked from
-- the browser roles in the same migration that creates it.
-- -----------------------------------------------------------------------------
create or replace function public.publisher_is_verified(
  p_owner_id uuid,
  p_agent_id uuid
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
    where m.status = 'approved'
      and m.verified_at is not null
      and m.user_id = coalesce(
        (select ap.user_id from public.agent_profiles ap where ap.id = p_agent_id),
        p_owner_id
      )
  );
$$;

comment on function public.publisher_is_verified is
  'True when the listing''s poster (its agent''s user, else its owner) holds an approved, verified membership. Backs property_listings.publisher_verified.';

-- -----------------------------------------------------------------------------
-- 3. The enforcement and synchronization triggers.
-- -----------------------------------------------------------------------------

-- BEFORE: refuse a badge write from anyone who is not a super admin, then clear
-- the badge when the capability ends.
--
-- The order matters. Clearing on suspension changes `verified_at` from a value to
-- null, which a naive "did the columns change?" test would read as a badge write
-- and refuse — so a real-estate administrator could not suspend a verified member,
-- which is the opposite of the intent. The guard therefore looks only at an
-- incoming NON-NULL value: setting a badge is the privileged act, removing one is
-- not.
create or replace function public.enforce_membership_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Granting a badge is the privileged act.
  if new.verified_at is not null or new.verified_by is not null then
    if tg_op = 'UPDATE'
       and new.verified_at is not distinct from old.verified_at
       and new.verified_by is not distinct from old.verified_by then
      -- The badge is unchanged; this is not a grant.
      null;
    elsif auth.uid() is not null and not public.is_super_admin() then
      -- `auth.uid() is null` is the trusted-context case: service role, psql, a
      -- migration, the validation harness. A browser session always carries a
      -- uid, so a badge can only be granted by a super admin through the
      -- application.
      raise exception 'Only a super admin may set publisher verification'
        using errcode = '42501';
    end if;
  end if;

  -- Leaving approved loses the badge: a suspended or rejected member must not
  -- keep a public trust mark.
  if new.status <> 'approved' then
    new.verified_at := null;
    new.verified_by := null;
  end if;

  return new;
end;
$$;

comment on function public.enforce_membership_verification is
  'Refuses a publisher-verification grant from a non-super-admin browser session, and clears the badge when a membership leaves approved.';

drop trigger if exists real_estate_memberships_enforce_verification
  on public.real_estate_memberships;
create trigger real_estate_memberships_enforce_verification
  before insert or update of status, verified_at, verified_by
  on public.real_estate_memberships
  for each row execute function public.enforce_membership_verification();

-- BEFORE on the listing: derive the flag from the poster on every write that can
-- change it.
create or replace function public.sync_listing_publisher_verified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.publisher_verified := public.publisher_is_verified(new.owner_id, new.agent_id);
  return new;
end;
$$;

comment on function public.sync_listing_publisher_verified is
  'Maintains property_listings.publisher_verified from the listing''s poster on insert and on a change of owner or agent.';

drop trigger if exists property_listings_sync_publisher_verified
  on public.property_listings;
create trigger property_listings_sync_publisher_verified
  before insert or update of owner_id, agent_id
  on public.property_listings
  for each row execute function public.sync_listing_publisher_verified();

-- AFTER on the membership: a verification change must reach the listings that
-- poster already holds, not only future ones.
create or replace function public.sync_membership_verification_listings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.property_listings p
  set publisher_verified = public.publisher_is_verified(p.owner_id, p.agent_id)
  where p.owner_id = new.user_id
     or p.agent_id in (
       select ap.id from public.agent_profiles ap where ap.user_id = new.user_id
     );
  return new;
end;
$$;

comment on function public.sync_membership_verification_listings is
  'Recomputes publisher_verified on every listing a poster holds when their membership or verification changes.';

drop trigger if exists real_estate_memberships_sync_verification_listings
  on public.real_estate_memberships;
create trigger real_estate_memberships_sync_verification_listings
  after insert or update of status, verified_at
  on public.real_estate_memberships
  for each row execute function public.sync_membership_verification_listings();

-- -----------------------------------------------------------------------------
-- 4. The denormalized column.
-- -----------------------------------------------------------------------------
alter table public.property_listings
  add column if not exists publisher_verified boolean not null default false;

comment on column public.property_listings.publisher_verified is
  'True when the listing''s poster holds an approved, verified membership. Maintained by trigger; read by the card badge and the "verified publishers" search filter.';

create index if not exists property_listings_publisher_verified_idx
  on public.property_listings (publisher_verified)
  where publisher_verified;

-- Backfill: a database that already holds listings and verified memberships must
-- agree with the trigger from the first read. Runs as the migration (a trusted
-- context), so it is not blocked by the enforcement trigger.
update public.property_listings p
set publisher_verified = public.publisher_is_verified(p.owner_id, p.agent_id)
where p.publisher_verified
   or public.publisher_is_verified(p.owner_id, p.agent_id);

-- -----------------------------------------------------------------------------
-- 5. The search function, with the currency and verified filters.
--
-- Dropped before it is recreated because BOTH the argument list and the return
-- type change. `create or replace` can only replace a function with the same
-- argument list, and a changed return type is refused outright — leaving the old
-- overload in place would make every RPC call fail with "function is not unique".
--
-- The signature named here must be the one that ACTUALLY EXISTS at this point —
-- the 19-argument version created by 20260101000030 — not the 22-argument one this
-- migration is about to create. Dropping the new signature was a no-op that left
-- the old overload alive, so `create or replace` added a second function and the
-- `comment on function` below failed with "function name is not unique", aborting
-- the whole migration on a fresh database.
-- -----------------------------------------------------------------------------
drop function if exists public.search_property_listings(
  text, uuid, uuid, uuid,
  public.listing_type, public.listing_property_kind, public.property_type,
  bigint, bigint, smallint, smallint, integer, integer,
  public.listing_status[], text[],
  public.locale_code, public.listing_sort_order,
  integer, integer
);

create or replace function public.search_property_listings(
  p_query text default null,
  p_region_id uuid default null,
  p_division_id uuid default null,
  p_subdivision_id uuid default null,
  -- Free-text locality/neighbourhood match, the "city or neighbourhood" field.
  -- Matched case-insensitively against the stored locality; it is a text column,
  -- not a geography row, because a neighbourhood is not part of the seeded
  -- administrative hierarchy.
  p_locality text default null,
  p_listing_type public.listing_type default null,
  p_property_kind public.listing_property_kind default null,
  p_property_type public.property_type default null,
  p_min_price bigint default null,
  p_max_price bigint default null,
  p_min_bedrooms smallint default null,
  p_min_bathrooms smallint default null,
  p_min_size integer default null,
  p_max_size integer default null,
  p_statuses public.listing_status[] default null,
  p_amenities text[] default null,
  -- The currency the price bounds are expressed in. The price comparison is
  -- meaningless across currencies, so a caller that sends a bound should send
  -- this too; the application always does.
  p_currency text default null,
  -- Restrict to listings posted by a verified landlord or agent.
  p_verified_only boolean default false,
  p_locale public.locale_code default 'en',
  p_sort public.listing_sort_order default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  reference text,
  title text,
  locality text,
  listing_type public.listing_type,
  property_kind public.listing_property_kind,
  price_minor bigint,
  currency text,
  price_period public.price_period,
  price_on_request boolean,
  bedrooms smallint,
  bathrooms smallint,
  land_area_sqm integer,
  building_area_sqm integer,
  is_featured boolean,
  view_count integer,
  publisher_verified boolean,
  published_at timestamptz,
  region_slug text,
  total_count bigint,
  rank real
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with params as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as q,
      case
        when nullif(btrim(coalesce(p_query, '')), '') is null then null
        else websearch_to_tsquery('english', p_query)
      end as tsq
  ),
  localized as (
    select
      t.entity_id,
      string_agg(t.value, ' ') as value
    from public.content_translations t
    where
      t.entity_type = 'property_listing'
      and t.locale = p_locale
      and t.field_name in ('title', 'description')
    group by t.entity_id
  ),
  matched as (
    select
      p.id,
      p.slug,
      p.reference,
      p.title,
      p.locality,
      p.listing_type,
      p.property_kind,
      p.price_minor,
      p.currency,
      p.price_period,
      p.price_on_request,
      p.bedrooms,
      p.bathrooms,
      p.land_area_sqm,
      p.building_area_sqm,
      p.is_featured,
      p.view_count,
      p.publisher_verified,
      p.published_at,
      r.slug as region_slug,
      (
        case
          when params.tsq is not null and p.search_vector @@ params.tsq
            then 1.0 + ts_rank(p.search_vector, params.tsq)
          when params.q is not null and loc.value ilike '%' || params.q || '%'
            then 1.0
          when params.q is not null
            and greatest(
              extensions.word_similarity(params.q, p.title),
              extensions.word_similarity(params.q, coalesce(p.locality, ''))
            ) > 0.4
            then greatest(
              extensions.word_similarity(params.q, p.title),
              extensions.word_similarity(params.q, coalesce(p.locality, ''))
            )
          else 0.0
        end
      )::real as rank
    from public.property_listings p
    join public.regions r on r.id = p.region_id
    left join localized loc on loc.entity_id = p.id
    cross join params
    where
      -- The public visibility set: the security control, separate from the
      -- visitor's own status filter below. A caller may narrow within it but
      -- cannot widen it.
      p.status = any (
        array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
      )
      and (p_statuses is null or p.status = any (p_statuses))
      and (p_region_id is null or p.region_id = p_region_id)
      and (p_division_id is null or p.division_id = p_division_id)
      and (p_subdivision_id is null or p.subdivision_id = p_subdivision_id)
      and (
        nullif(btrim(coalesce(p_locality, '')), '') is null
        or p.locality ilike '%' || btrim(p_locality) || '%'
      )
      and (p_listing_type is null or p.listing_type = p_listing_type)
      and (p_property_kind is null or p.property_kind = p_property_kind)
      and (p_property_type is null or p.property_type = p_property_type)
      -- Price is compared within one currency. The currency predicate is applied
      -- whenever a currency is given, which the application does alongside any
      -- price bound, so the two numbers compared are always the same unit.
      and (p_currency is null or p.currency = p_currency)
      and (p_min_price is null or p.price_minor >= p_min_price)
      and (p_max_price is null or p.price_minor <= p_max_price)
      and (p_min_bedrooms is null or p.bedrooms >= p_min_bedrooms)
      and (p_min_bathrooms is null or p.bathrooms >= p_min_bathrooms)
      and (
        p_min_size is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) >= p_min_size
      )
      and (
        p_max_size is null
        or greatest(coalesce(p.land_area_sqm, 0), coalesce(p.building_area_sqm, 0)) <= p_max_size
      )
      and (p_amenities is null or p_amenities <@ p.amenities)
      -- The verified-publisher filter. `not coalesce(...)` so a null parameter
      -- means "do not filter" rather than "filter everything out".
      and (not coalesce(p_verified_only, false) or p.publisher_verified)
      and (
        params.q is null
        or p.search_vector @@ params.tsq
        or loc.value ilike '%' || params.q || '%'
        or greatest(
             extensions.word_similarity(params.q, p.title),
             extensions.word_similarity(params.q, coalesce(p.locality, ''))
           ) > 0.4
        or p.locality ilike '%' || params.q || '%'
      )
  ),
  counted as (
    select m.*, count(*) over () as total_count
    from matched m
  )
  select
    v.id, v.slug, v.reference, v.title, v.locality, v.listing_type,
    v.property_kind, v.price_minor, v.currency, v.price_period,
    v.price_on_request, v.bedrooms, v.bathrooms, v.land_area_sqm,
    v.building_area_sqm, v.is_featured, v.view_count, v.publisher_verified,
    v.published_at, v.region_slug, v.total_count, v.rank
  from counted v
  order by
    case when p_sort = 'relevance' then v.rank end desc nulls last,
    case when p_sort = 'newest' then v.is_featured end desc nulls last,
    case when p_sort = 'price_asc' then v.price_minor end asc nulls last,
    case when p_sort = 'price_desc' then v.price_minor end desc nulls last,
    case when p_sort = 'most_viewed' then v.view_count end desc nulls last,
    v.rank desc,
    v.published_at desc nulls last,
    v.reference asc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

comment on function public.search_property_listings is
  'The public listings query engine: AND-combined structured filters, a currency-scoped price filter, a verified-publisher filter, localized keyword match, total count and pagination in one round trip. Published listings only.';

-- The function is on the Phase 12 browser allow-list, so it keeps its grant. It
-- is SECURITY DEFINER but pins the public status set internally, so the grant is
-- not a way to read a draft.
grant execute on function public.search_property_listings(
  text, uuid, uuid, uuid, text, public.listing_type, public.listing_property_kind,
  public.property_type,
  bigint, bigint, smallint, smallint, integer, integer,
  public.listing_status[], text[], text, boolean,
  public.locale_code, public.listing_sort_order,
  integer, integer
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Facet counts for the marketplace navigation.
--
-- The marketplace homepage and the sidebar offer category shortcuts, a currency
-- selector and an amenity filter. A count beside any of them has to be a real
-- count of what the visitor would see, or it is a fabricated statistic. This
-- returns one row per facet value under the SAME visibility predicate the search
-- uses, so a shortcut reading "12" leads to a result set of 12.
--
-- One function rather than three, because the three are the same computation
-- over different columns and a single call is one round trip. The `facet` column
-- discriminates: `category` values are the sidebar's own buckets, `currency` and
-- `amenity` are the values that actually occur, so neither list can offer a
-- choice that matches nothing.
-- -----------------------------------------------------------------------------
create or replace function public.listing_facets()
returns table (facet text, value text, total bigint)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with visible as (
    select p.listing_type, p.property_kind, p.property_type, p.currency, p.amenities
    from public.property_listings p
    where p.status = any (
      array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
    )
  )
  -- Category buckets: the exact filter combinations the sidebar and the
  -- homepage shortcuts offer, so each count equals the result set its link leads
  -- to. A bucket must never be a broader or narrower predicate than its link.
  select 'category'::text, 'all'::text, count(*) from visible
  union all
  select 'category', 'for_sale', count(*) from visible where listing_type = 'sale'
  union all
  select 'category', 'for_rent', count(*) from visible where listing_type = 'rent'
  union all
  select 'category', 'short_term', count(*)
    from visible where listing_type = 'short_term'
  union all
  select 'category', 'land_sale', count(*)
    from visible where listing_type = 'sale' and property_kind = 'land'
  union all
  select 'category', 'land_rent', count(*)
    from visible where listing_type = 'rent' and property_kind = 'land'
  union all
  select 'category', 'commercial', count(*)
    from visible where property_type = 'commercial'
  union all
  select 'category', 'house', count(*)
    from visible where property_kind = 'house'
  union all
  select 'category', 'apartment', count(*)
    from visible where property_kind = 'apartment'
  -- Currencies actually in use. A price filter must say which unit it applies
  -- to, so the selector offers only units that occur rather than a fixed list.
  union all
  select 'currency', v.currency, count(*)
    from visible v group by v.currency
  -- Amenities actually recorded, so the filter cannot offer a slug no listing
  -- carries.
  union all
  select 'amenity', a.slug, count(*)
    from visible v cross join lateral unnest(v.amenities) as a(slug)
    group by a.slug;
$$;

comment on function public.listing_facets is
  'Public facet counts (category buckets, currencies, amenities) under the same visibility predicate as search_property_listings, so a facet count always equals its result set.';

grant execute on function public.listing_facets() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. EXECUTE classification.
--
-- Supabase grants EXECUTE on every new public function to anon and authenticated
-- by default, and the Phase 12 hardening ran long before this migration. The
-- helper functions above are internal — called by triggers and by the RPC, never
-- by a browser — so each is revoked from both roles here, in the same migration
-- that creates it. The subset assertion in `30_function_execute_hardening.sql`
-- fails if a future function is left unclassified, and this keeps that assertion
-- satisfied for these.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'publisher_is_verified',
        'enforce_membership_verification',
        'sync_listing_publisher_verified',
        'sync_membership_verification_listings'
      )
  loop
    execute format('revoke all on function %s from public', v_fn.signature);
    execute format('revoke all on function %s from anon, authenticated', v_fn.signature);
    execute format('grant execute on function %s to service_role', v_fn.signature);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- 7. Behavioural proof.
--
-- Runs on every migration application, on a fresh database, and aborts the
-- migration if the boundary is wrong — rather than shipping and letting a
-- validation script catch it later. The fixture is created and cleaned up inside
-- the block, and the cleanup removes the translation rows the listing insert
-- fires (`sync_listing_translation_index`), which have no FK to the listing and
-- would otherwise be stranded.
-- -----------------------------------------------------------------------------
do $$
declare
  v_landlord uuid := extensions.gen_random_uuid();
  v_region uuid;
  v_listing uuid;
  v_membership uuid;
  v_verified boolean;
begin
  select id into v_region from public.regions order by sort_order limit 1;
  if v_region is null then
    raise notice 'SKIP  publisher verification proof: no regions seeded yet';
    return;
  end if;

  -- A real account, because owner_id, user_id and verified_by all reference
  -- auth.users. The insert is a trusted context (auth.uid() is null), so the
  -- enforcement trigger permits the badge write.
  insert into auth.users (id, email)
  values (v_landlord, 'verification-proof@example.test');

  insert into public.real_estate_memberships (
    user_id, membership_type, status, approved_by, approved_at
  )
  values (v_landlord, 'landlord', 'approved', v_landlord, now())
  returning id into v_membership;

  insert into public.property_listings (
    title, description, listing_type, property_kind, property_type,
    region_id, owner_id, status, slug
  )
  values (
    -- The description must clear `property_listings_description_length`
    -- (20-20000 chars); a short placeholder aborts the migration on a fresh
    -- database before any of the assertions below run.
    'Verification proof listing',
    'A fixture used to prove the publisher-verification boundary.',
    'sale', 'house', 'residential',
    v_region, v_landlord, 'draft', 'verification-proof-listing'
  )
  returning id into v_listing;

  -- An approved but unverified landlord must NOT be verified.
  select publisher_verified into v_verified
  from public.property_listings where id = v_listing;
  if v_verified then
    raise exception 'VALIDATION FAIL: an unverified landlord''s listing was marked verified';
  end if;

  -- Granting the badge must flip the listing.
  update public.real_estate_memberships
  set verified_at = now(), verified_by = v_landlord
  where id = v_membership;

  select publisher_verified into v_verified
  from public.property_listings where id = v_listing;
  if not v_verified then
    raise exception 'VALIDATION FAIL: a verified landlord''s listing was not marked verified';
  end if;

  -- Suspending the membership must remove the badge.
  update public.real_estate_memberships
  set status = 'suspended', suspended_at = now(), suspension_reason = 'proof'
  where id = v_membership;

  select publisher_verified into v_verified
  from public.property_listings where id = v_listing;
  if v_verified then
    raise exception 'VALIDATION FAIL: a suspended member kept the verified badge';
  end if;

  if exists (
    select 1 from public.real_estate_memberships
    where id = v_membership and (verified_at is not null or verified_by is not null)
  ) then
    raise exception 'VALIDATION FAIL: suspension did not clear the verification columns';
  end if;

  -- Cleanup. Inserting the listing fired `sync_listing_translation_index`, whose
  -- rows have no FK to the listing and would otherwise be stranded. Entries are
  -- deleted first so their queued jobs cascade. The membership decisions also
  -- wrote audit rows, and inserting the auth user fired `handle_new_user`, which
  -- provisioned a profile — both are removed so a migration applied to a live
  -- database leaves nothing behind.
  delete from public.translation_entries
  where entity_type = 'property_listing' and entity_id = v_listing;
  delete from public.content_translations
  where entity_type = 'property_listing' and entity_id = v_listing;
  delete from public.property_listings where id = v_listing;
  delete from public.audit_logs
  where entity_type = 'real_estate_membership' and entity_id = v_membership::text;
  delete from public.real_estate_memberships where id = v_membership;
  delete from public.profiles where id = v_landlord;
  delete from auth.users where id = v_landlord;

  raise notice 'PASS  publisher verification is granted by hand, shown on listings, and cleared on suspension';
end
$$;
