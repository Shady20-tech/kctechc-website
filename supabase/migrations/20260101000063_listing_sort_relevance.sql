-- =============================================================================
-- Phase 4 — the "Most relevant" sort order.
--
-- The brief lists "Most relevant" first among the sort options. The search
-- function already computes a relevance rank (full-text rank, then a trigram
-- fallback), but it was only used as a tie-breaker under `newest`; there was no
-- way to ask for relevance ordering outright.
--
-- Postgres refuses to use a newly-added enum value in the same transaction that
-- adds it ("unsafe use of new value of enum type"), and Supabase runs each
-- migration in a transaction. So the value is added here, in its own migration,
-- and used by the search function redefined in the next one.
-- =============================================================================

alter type public.listing_sort_order add value if not exists 'relevance';

comment on type public.listing_sort_order is
  'Orderings the public listing search offers. `relevance` orders by the search rank (full-text, then trigram similarity); the others are newest, price and view count.';
