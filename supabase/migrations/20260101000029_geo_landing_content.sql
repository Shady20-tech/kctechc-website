-- =============================================================================
-- Phase 7 — Curated content for geographic landing pages.
--
-- Requirement: "Geographic landing pages are indexable only when they contain
-- meaningful content", and its counterpart: "Do not make every arbitrary filter
-- combination indexable."
--
-- The way both are satisfied is that a geographic landing page is indexable
-- exactly when an editor has written content for it. A page assembled from a
-- region name and a generated sentence ("Properties in Littoral") is a doorway
-- page, and there is no threshold of listing count that turns one into useful
-- content. So indexability is a property of this table, not of a heuristic:
--
--   * a row exists and is published  -> the landing page is indexable
--   * no row                        -> the URL still renders (it is a real,
--                                      useful filtered view) but carries
--                                      `noindex, follow` and canonicalizes to
--                                      the plain listings browser
--
-- The row is keyed per locale because the content is written per locale; an
-- English intro with no French counterpart means the French page is not yet
-- indexable, which is the honest state rather than an English page served under
-- a French canonical.
--
-- Nothing is seeded. Inventing an intro for each of Cameroon's regions would put
-- fabricated editorial content on an indexable page under the company's name.
-- =============================================================================

create type public.geo_landing_level as enum ('region', 'division', 'subdivision');

create table public.geo_landing_content (
  id uuid primary key default extensions.gen_random_uuid(),

  level public.geo_landing_level not null,

  -- Three nullable parents rather than one polymorphic id, so each level keeps a
  -- real foreign key. The check below requires exactly one, which makes a row
  -- that points at nothing — or at two levels at once — unrepresentable.
  region_id uuid references public.regions (id) on delete cascade,
  division_id uuid references public.divisions (id) on delete cascade,
  subdivision_id uuid references public.subdivisions (id) on delete cascade,

  -- The geography the row describes, whichever level it is. Generated so the
  -- uniqueness constraint below can be written once instead of three times.
  geo_id uuid generated always as (
    coalesce(region_id, division_id, subdivision_id)
  ) stored,

  locale public.locale_code not null,

  -- The editorial content. `intro` is what makes the page worth indexing: it is
  -- the unique, useful prose a doorway page lacks. A heading is optional because
  -- the geography's own name is a correct fallback heading.
  heading text,
  intro text not null,

  -- SEO overrides, matching `entity_seo`'s shape so an editor has one mental
  -- model for both.
  seo_title text,
  seo_description text,

  state public.publish_state not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint geo_landing_content_exactly_one_parent check (
    (region_id is not null)::int
    + (division_id is not null)::int
    + (subdivision_id is not null)::int
    = 1
  ),
  -- The level must agree with which parent is set. Without this a row could say
  -- `level = 'region'` while carrying a subdivision id.
  constraint geo_landing_content_level_matches_parent check (
    (level = 'region' and region_id is not null)
    or (level = 'division' and division_id is not null)
    or (level = 'subdivision' and subdivision_id is not null)
  ),
  constraint geo_landing_content_intro_length check (
    char_length(intro) between 80 and 4000
  ),
  constraint geo_landing_content_heading_length check (
    heading is null or char_length(heading) between 1 and 200
  ),
  constraint geo_landing_content_seo_title_length check (
    seo_title is null or char_length(seo_title) between 1 and 200
  ),
  constraint geo_landing_content_seo_description_length check (
    seo_description is null or char_length(seo_description) between 1 and 400
  ),
  constraint geo_landing_content_unique unique (geo_id, locale)
);

comment on table public.geo_landing_content is
  'Editorial content for a geographic landing page. A published row is what makes that page indexable.';

create index geo_landing_content_geo_idx
  on public.geo_landing_content (geo_id, locale)
  where state = 'published';

create trigger geo_landing_content_set_updated_at
  before update on public.geo_landing_content
  for each row execute function public.set_updated_at();

alter table public.geo_landing_content enable row level security;

-- Public read of published rows only. The listings browser reads this to decide
-- indexability and to render the intro, so an anonymous policy is correct here.
-- Draft content is not readable by a visitor — otherwise an unpublished intro
-- would be servable even though the page is marked noindex.
create policy "geo_landing_content_select_published"
  on public.geo_landing_content for select
  to anon, authenticated
  using (state = 'published');

create policy "geo_landing_content_write_admin"
  on public.geo_landing_content for all
  to authenticated
  using (public.is_admin() or public.is_real_estate_admin())
  with check (public.is_admin() or public.is_real_estate_admin());
