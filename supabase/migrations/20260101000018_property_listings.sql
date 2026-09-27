-- =============================================================================
-- Phase 6 — Property listings: the core record.
--
-- The central design decision is that this table has TWO audiences with
-- different rights, and the difference is enforced by columns and policies rather
-- than by which page reads them:
--
--   * The public sees an area, a price and a description.
--   * The team sees an exact address, coordinates, and the owner's contact
--     details.
--
-- So private data is not merely absent from a public query. It is stored on a
-- SEPARATE table (`listing_private_details`) with no anonymous policy at all,
-- which is the only arrangement where a future change to a public query cannot
-- accidentally expose it. A column that is present-but-unselected is one careless
-- `select('*')` away from disclosure; a column on a table the anonymous role
-- cannot read is not.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Search helpers.
--
-- `array_to_string` is STABLE rather than IMMUTABLE, because a type's output
-- function is not guaranteed immutable in general. That makes it unusable in a
-- generated column, so the conversion gets an immutable wrapper. This is sound
-- for `text[]` specifically: text's output function is deterministic and has no
-- locale dependence.
-- -----------------------------------------------------------------------------
create or replace function public.immutable_array_to_string(arr text[])
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(array_to_string(arr, ' '), '');
$$;

comment on function public.immutable_array_to_string is
  'IMMUTABLE wrapper over array_to_string so a generated search vector may include an array column.';

-- `publish_state_is_consistent` is used by the table constraint below. Defined
-- first because a CHECK constraint is validated when the table is created.
create or replace function public.publish_state_is_consistent(
  p_published_at timestamptz,
  p_status public.listing_status
)
returns boolean
language sql
immutable
as $$
  select p_status <> 'published' or p_published_at is not null;
$$;

-- -----------------------------------------------------------------------------
-- Property listings.
-- -----------------------------------------------------------------------------
create table public.property_listings (
  id uuid primary key default extensions.gen_random_uuid(),

  -- Human-readable listing ID, the one the team and the owner quote to each
  -- other. Generated rather than entered, so it cannot be duplicated or reused.
  reference text not null unique,

  -- Canonical (source-locale) slug. Localized slugs live in
  -- `listing_slugs`, matching how products handle a localized URL segment.
  slug text not null unique,

  -- What is being offered and what it is.
  listing_type public.listing_type not null,
  property_kind public.listing_property_kind not null,
  -- The broad class, reused from the electrical domain so the two departments
  -- filter property the same way.
  property_type public.property_type not null,
  status public.listing_status not null default 'draft',
  source public.listing_source not null default 'admin',

  -- Geography. Region is required: a Cameroonian listing with no region cannot
  -- be placed, filtered or reported on. Division and subdivision are optional
  -- because the official datasets are loaded separately and a listing may be
  -- recorded before its subdivision is known — but when present they must agree
  -- with the region, which the composite FKs below enforce.
  region_id uuid not null references public.regions (id) on delete restrict,
  division_id uuid,
  subdivision_id uuid,
  -- Free-text locality: the neighbourhood, quarter or landmark a person would
  -- actually say. Distinct from the administrative subdivision.
  locality text,

  -- ---------------------------------------------------------------- Content ---
  title text not null,
  description text not null,
  -- Selling points shown as a list. An array rather than a delimited string so
  -- an individual highlight cannot contain the delimiter.
  highlights text[] not null default '{}',
  -- Features and amenities as stable slugs (`pool`, `borehole`, `solar`), so a
  -- filter cannot fragment on spelling. Kept as text so a new amenity does not
  -- need a migration.
  amenities text[] not null default '{}',

  -- ------------------------------------------------------------------ Money ---
  -- Stored in minor units as a whole number, matching `products`. A float would
  -- accumulate rounding error across a portfolio, and a currency amount must be
  -- exact.
  price_minor bigint,
  currency text not null default 'XAF',
  price_period public.price_period not null default 'total',
  -- True when the owner wants offers rather than stating a figure. Separate from
  -- a null price, because "no price stated yet" and "deliberately price on
  -- application" are different facts.
  price_on_request boolean not null default false,

  -- ------------------------------------------------------------ Dimensions ---
  -- Square metres, matching how land and floor area are quoted here.
  land_area_sqm integer,
  building_area_sqm integer,
  bedrooms smallint,
  bathrooms smallint,
  -- Some listings genuinely have none (land, a warehouse), so zero is allowed
  -- while negative is not.
  year_built smallint,

  -- ------------------------------------------------------------------ Media ---
  virtual_tour_url text,
  video_url text,

  -- ------------------------------------------------------------ Visibility ---
  is_featured boolean not null default false,
  -- Denormalized analytics counters. Kept on the row so the listing card can
  -- sort by popularity without aggregating the event table on every request.
  -- The events table remains the source of truth; these are a maintained cache,
  -- written only by `recount_listing_metrics()`.
  view_count integer not null default 0,
  inquiry_count integer not null default 0,

  -- ------------------------------------------------------------ Lifecycle ---
  published_at timestamptz,
  -- Set when the listing leaves the market. Distinguishes a sold listing from
  -- one that was withdrawn, which the status alone does not.
  closed_at timestamptz,
  listed_on date,
  -- Who owns the listing. Null for a listing created directly by an admin with
  -- no agent assigned yet.
  agent_id uuid references public.agent_profiles (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Full-text search across the fields a person would type. Generated so it can
  -- never fall out of step with the row it describes; an application-maintained
  -- vector is a vector that is eventually wrong.
  search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' '
      || coalesce(locality, '') || ' '
      || public.immutable_array_to_string(highlights)
    )
  ) stored,

  constraint property_listings_reference_format check (
    reference ~ '^KC-RE-[0-9]{6}$'
  ),
  constraint property_listings_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint property_listings_title_length check (
    char_length(title) between 4 and 200
  ),
  constraint property_listings_description_length check (
    char_length(description) between 20 and 20000
  ),
  constraint property_listings_locality_length check (
    locality is null or char_length(locality) between 1 and 160
  ),
  constraint property_listings_currency_format check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint property_listings_price_positive check (
    price_minor is null or price_minor > 0
  ),
  -- A price and "price on request" are contradictory statements. Allowing both
  -- would make the card's behaviour depend on which field a renderer checked.
  constraint property_listings_price_consistency check (
    not price_on_request or price_minor is null
  ),
  constraint property_listings_areas_positive check (
    (land_area_sqm is null or land_area_sqm > 0)
    and (building_area_sqm is null or building_area_sqm > 0)
  ),
  constraint property_listings_rooms_non_negative check (
    (bedrooms is null or bedrooms between 0 and 50)
    and (bathrooms is null or bathrooms between 0 and 50)
  ),
  constraint property_listings_year_built_range check (
    year_built is null or year_built between 1800 and 2100
  ),
  -- Publication must be timestamped, matching every other publishable entity.
  constraint property_listings_published_requires_at check (
    publish_state_is_consistent(published_at, status)
  ),
  -- A listing that has left the market must record when, so "sold last month"
  -- is answerable without reading the audit trail.
  constraint property_listings_closed_requires_at check (
    status not in ('sold', 'rented', 'archived') or closed_at is not null
  ),
  -- Listing type and price period must agree. A nightly rate on a freehold sale
  -- is a data-entry error, not a legitimate offering.
  constraint property_listings_period_matches_type check (
    case listing_type
      when 'sale' then price_period in ('total')
      when 'rent' then price_period in ('monthly', 'quarterly', 'yearly')
      when 'lease' then price_period in ('monthly', 'quarterly', 'yearly')
      when 'short_term' then price_period in ('nightly', 'weekly', 'monthly')
    end
  ),
  -- A URL that reaches the database must be http(s); a `javascript:` value in a
  -- rendered href would be an injection.
  constraint property_listings_virtual_tour_url check (
    virtual_tour_url is null or virtual_tour_url ~* '^https?://[^\s]+$'
  ),
  constraint property_listings_video_url check (
    video_url is null or video_url ~* '^https?://[^\s]+$'
  ),

  -- Geography consistency, enforced structurally. A division paired with the
  -- wrong region has no matching parent row, so the insert is rejected by the
  -- foreign key rather than by a rule someone has to remember to check.
  constraint property_listings_division_region_fkey
    foreign key (division_id, region_id)
    references public.divisions (id, region_id)
    on delete restrict,
  constraint property_listings_subdivision_region_fkey
    foreign key (subdivision_id, division_id, region_id)
    references public.subdivisions (id, division_id, region_id)
    on delete restrict
);

comment on table public.property_listings is
  'Real estate listings. Public and private data are separated: exact address, coordinates and owner contact live in listing_private_details, which has no anonymous policy.';
comment on column public.property_listings.view_count is
  'Denormalized cache of listing_events. Maintained by recount_listing_metrics(); the event table is the source of truth.';
comment on column public.property_listings.amenities is
  'Stable feature slugs (pool, borehole, solar). Text rather than an enum so a new amenity needs no migration.';

-- `publish_state_is_consistent` is referenced by the constraint above. It exists
-- as a function so the rule reads the same way wherever it is applied.

-- -----------------------------------------------------------------------------
-- Reference generator: KC-RE-NNNNNN
--
-- Allocated from a sequence so two concurrent inserts cannot collide, which a
-- random suffix cannot guarantee.
-- -----------------------------------------------------------------------------
create sequence public.property_listing_reference_seq start 1;

create or replace function public.generate_listing_reference()
returns text
language sql
volatile
as $$
  select 'KC-RE-' || lpad(nextval('public.property_listing_reference_seq')::text, 6, '0');
$$;

comment on function public.generate_listing_reference() is
  'Sequential listing reference, e.g. KC-RE-000042. A sequence rather than a random suffix so concurrent inserts cannot collide.';

-- -----------------------------------------------------------------------------
-- Indexes for the filters the public site and the admin both use.
--
-- Partial indexes on `status = 'published'` are the important ones: the public
-- list only ever reads published rows, so the index can be a fraction of the
-- table and still answer every public query.
-- -----------------------------------------------------------------------------
create index property_listings_public_idx
  on public.property_listings (published_at desc)
  where status = 'published';

create index property_listings_region_filter_idx
  on public.property_listings (region_id, property_kind, listing_type)
  where status = 'published';

create index property_listings_kind_filter_idx
  on public.property_listings (property_kind, listing_type, price_minor)
  where status = 'published';

create index property_listings_price_idx
  on public.property_listings (price_minor)
  where status = 'published' and price_minor is not null;

create index property_listings_bedrooms_idx
  on public.property_listings (bedrooms)
  where status = 'published' and bedrooms is not null;

-- Featured listings are a small, hot subset read on the home page.
create index property_listings_featured_idx
  on public.property_listings (published_at desc)
  where status = 'published' and is_featured;

-- The agent's own-listings view, which is also the access-control boundary.
create index property_listings_agent_idx
  on public.property_listings (agent_id, status, updated_at desc)
  where agent_id is not null;

-- The moderation queue.
create index property_listings_review_idx
  on public.property_listings (status, updated_at desc)
  where status in ('pending_review', 'rejected');

create index property_listings_amenities_idx
  on public.property_listings using gin (amenities);

-- Full-text search, and trigram for the typo-tolerant "did you mean" path. Both
-- are needed: the vector answers "find me a villa in Limbe", trigram answers
-- "limb" and "vila". Neither requires a separate search service.
create index property_listings_search_idx
  on public.property_listings using gin (search_vector);

create index property_listings_title_trgm_idx
  on public.property_listings using gin (title extensions.gin_trgm_ops);

create index property_listings_locality_trgm_idx
  on public.property_listings using gin (locality extensions.gin_trgm_ops);

create trigger property_listings_set_updated_at
  before update on public.property_listings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Localized slugs, matching the product pattern.
-- -----------------------------------------------------------------------------
create table public.listing_slugs (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.property_listings (id) on delete cascade,
  locale public.locale_code not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One slug per locale per listing, and one listing per slug per locale. The
  -- second is what stops two listings claiming the same French URL.
  constraint listing_slugs_unique_listing_locale unique (listing_id, locale),
  constraint listing_slugs_unique_locale_slug unique (locale, slug),
  constraint listing_slugs_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  )
);

comment on table public.listing_slugs is
  'Localized URL slugs. The canonical slug stays on property_listings; this holds per-locale overrides.';

create index listing_slugs_slug_idx on public.listing_slugs (slug);

create trigger listing_slugs_set_updated_at
  before update on public.listing_slugs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Private listing details.
--
-- A separate table, not nullable columns on the listing, because the anonymous
-- role has no policy here at all. A public query physically cannot read these
-- rows, so no future edit to a public loader can leak them.
--
-- One row per listing, created with the listing. It is not optional: a listing
-- whose private row is missing would silently have no coordinates and no owner
-- contact, and the absence would look like "not recorded" rather than "broken".
-- -----------------------------------------------------------------------------
create table public.listing_private_details (
  listing_id uuid primary key references public.property_listings (id) on delete cascade,

  -- The exact position, for internal use and for distance search.
  -- `geometry(Point,4326)` rather than `geography`: ST_X/ST_Y read the
  -- coordinates back directly, which a geography column does not allow without a
  -- cast, and the distance queries that matter here cast to geography at the
  -- point of use.
  exact_location extensions.geometry(Point, 4326),
  -- The exact street address. Free text because addresses here are descriptive
  -- (a quarter, a landmark, a plot number) rather than a postal-code system.
  exact_address text,

  -- Owner contact. Kept off the public row so an owner's phone number is not one
  -- careless select away from a public response.
  owner_name text,
  owner_phone text,
  owner_email extensions.citext,
  owner_notes text,

  -- Internal notes that must never render publicly.
  internal_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint listing_private_details_exact_address_length check (
    exact_address is null or char_length(exact_address) between 1 and 300
  ),
  constraint listing_private_details_owner_name_length check (
    owner_name is null or char_length(owner_name) between 1 and 200
  ),
  constraint listing_private_details_owner_phone_length check (
    owner_phone is null or char_length(owner_phone) between 5 and 40
  ),
  constraint listing_private_details_owner_email_length check (
    owner_email is null or char_length(owner_email::text) <= 254
  ),
  -- Coordinates must be a real position on Earth. A swapped lat/lng pair is a
  -- common data-entry error and would place a Limbe listing in the Atlantic.
  constraint listing_private_details_location_in_cameroon check (
    exact_location is null or (
      extensions.ST_X(exact_location) between 8.0 and 17.0
      and extensions.ST_Y(exact_location) between 1.0 and 13.5
    )
  )
);

comment on table public.listing_private_details is
  'Exact coordinates, street address and owner contact. No anonymous policy exists: the public role cannot read this table at all.';
comment on column public.listing_private_details.exact_location is
  'Exact position as geometry(Point,4326). The public surface reads a grid-snapped point from public_listing_locations instead.';

-- GiST index for distance and bounding-box search.
create index listing_private_details_location_idx
  on public.listing_private_details using gist (exact_location);

create trigger listing_private_details_set_updated_at
  before update on public.listing_private_details
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Public listing locations.
--
-- The exact coordinate must not be published: an exact pin on a residential
-- listing tells the world where the owner lives, and the phase requires a check
-- for exactly this. The public surface therefore reads a point snapped to a
-- grid, which preserves "which part of town" for the map without disclosing
-- which building.
--
-- A table rather than a view so the fuzzing happens once, on write, and the
-- public read is a plain indexed select. It is maintained by a trigger on the
-- private row, so the two cannot drift.
-- -----------------------------------------------------------------------------
create table public.public_listing_locations (
  listing_id uuid primary key references public.property_listings (id) on delete cascade,
  -- The point rounded to 2 decimal places, which is roughly a 1 km cell. Coarse
  -- enough that it does not identify a property; fine enough that a map still
  -- groups listings by area.
  approximate_location extensions.geometry(Point, 4326),
  -- The precision, stated in the row rather than implied, so a future change to
  -- the fuzzing distance is visible in the data and a consumer can decide whether
  -- the point is safe to show.
  precision_metres integer not null default 1000,
  updated_at timestamptz not null default now(),

  constraint public_listing_locations_precision_positive check (
    precision_metres between 100 and 50000
  )
);

comment on table public.public_listing_locations is
  'Deliberately coarsened listing positions for the public map. Derived from listing_private_details.exact_location by snapping to a ~1km grid.';

create index public_listing_locations_gix
  on public.public_listing_locations using gist (approximate_location);

create trigger public_listing_locations_set_updated_at
  before update on public.public_listing_locations
  for each row execute function public.set_updated_at();

/**
 * Derive the public, coarsened position from the exact one.
 *
 * `ST_SnapToGrid` is used rather than adding random noise, for a specific
 * reason: random offsets are not reproducible, so the same listing would appear
 * to move between renders, and a caller with two observations could average them
 * to recover the true position. A grid snap is deterministic and non-invertible
 * — every listing in the same cell yields the same published point, so the map
 * reveals the cell and nothing about which address within it.
 */
create or replace function public.sync_public_listing_location()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.exact_location is null then
    delete from public.public_listing_locations where listing_id = new.listing_id;
    return new;
  end if;

  insert into public.public_listing_locations (
    listing_id, approximate_location, precision_metres
  )
  values (
    new.listing_id,
    extensions.ST_SnapToGrid(new.exact_location, 0.01),
    1000
  )
  on conflict (listing_id) do update
    set approximate_location = excluded.approximate_location,
        precision_metres = excluded.precision_metres,
        updated_at = now();

  return new;
end;
$$;

comment on function public.sync_public_listing_location is
  'Snaps the exact coordinate to a ~1km grid for public display. Deterministic and non-invertible, unlike random offsets.';

create trigger listing_private_details_sync_public_location
  after insert or update of exact_location or delete on public.listing_private_details
  for each row execute function public.sync_public_listing_location();
