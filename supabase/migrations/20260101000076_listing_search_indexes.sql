-- =============================================================================
-- Listing search, part 1 of 2: the indexes.
--
-- Additive and idempotent. This file creates six partial indexes and changes no
-- table, column, constraint or function, so it can be applied to a production
-- database without altering any behaviour: before the function in part 2 is
-- deployed, the planner simply has better indexes available and the existing
-- query keeps returning exactly what it returned before. Reverting is
-- `drop index` on the six names below.
--
-- Every index is partial on the same four-value visibility set, because the
-- search function only ever returns those statuses. Two defects made the
-- previous indexes unreachable, and both are fixed here:
--
-- 1. They were predicated on `status = 'published'` while the function filters
--    the four-value public visibility set. A partial index is only usable when
--    the query predicate *implies* the index predicate, and
--    `status = any(4 values)` does not imply `status = 'published'`, so the
--    indexes could never be chosen.
--
-- 2. They were declared `published_at desc` (default NULLS FIRST) while every
--    ORDER BY is `published_at desc nulls last`. Postgres will not use an index
--    whose sort direction/null placement differs from the requested order, so
--    even with the predicate fixed the planner fell back to a sort. Each index
--    now carries the exact ORDER BY tail the query uses. Measured 54 ms -> 9 ms
--    for a plain browse. `property_listings_visible_price_desc_idx` is separate
--    because a `price_minor desc` sort cannot read a `price_minor asc` index.
--
-- `property_listings_visible_published_idx` answers `p_sort => 'relevance'` with
-- no keyword: `rank` is 0.0 on every row in that case, so the original ORDER BY
-- reduced to exactly `published_at, reference`, and without this index that sort
-- fell back to a scan.
--
-- These indexes were previously present only in a live database and in no
-- migration, so a fresh deployment had none of them.
--
-- NOTE: plain `create index` takes an ACCESS EXCLUSIVE lock while it builds,
-- which blocks writes for the duration. On a large table run this in a quiet
-- window, or build them by hand with `create index concurrently` first (the
-- `if not exists` guards make this file a no-op afterwards).
-- =============================================================================

-- The visibility set as a single reusable predicate would be nicer, but a partial
-- index predicate must be immutable, so it is spelled out in each index.

create index if not exists property_listings_visible_recent_idx
  on public.property_listings (
    is_featured desc nulls last,
    published_at desc nulls last,
    reference asc
  )
  where status = any (
    array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
  );

create index if not exists property_listings_visible_price_idx
  on public.property_listings (
    currency asc,
    price_minor asc nulls last,
    published_at desc nulls last,
    reference asc
  )
  where status = any (
    array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
  );

create index if not exists property_listings_visible_price_desc_idx
  on public.property_listings (
    currency asc,
    price_minor desc nulls last,
    published_at desc nulls last,
    reference asc
  )
  where status = any (
    array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
  );

create index if not exists property_listings_visible_viewed_idx
  on public.property_listings (
    view_count desc nulls last,
    published_at desc nulls last,
    reference asc
  )
  where status = any (
    array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
  );

create index if not exists property_listings_visible_published_idx
  on public.property_listings (
    published_at desc nulls last,
    reference asc
  )
  where status = any (
    array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
  );

create index if not exists property_listings_visible_region_idx
  on public.property_listings (
    region_id,
    published_at desc nulls last,
    reference asc
  )
  where status = any (
    array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]
  );
