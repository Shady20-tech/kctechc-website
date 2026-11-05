-- =============================================================================
-- Correct the stored head-office locality.
--
-- The footer renders the address from `site_settings.site.contact`, falling back
-- to the business brief only when the row is absent or malformed
-- (`src/lib/config/site-content.ts`). `asAddress` accepts any non-empty string per
-- field, so a misspelt locality in the row is rendered verbatim and never falls
-- back — which is why a typo in this row reaches production while every string in
-- the repository still reads "Limbe".
--
-- `supabase/seed.sql` carries the correct value, but seeding only runs on a
-- database that is being created; an existing production row is never revisited
-- by it. This migration repairs the stored value in place.
--
-- Only the `address` key is rewritten, via `jsonb_set`, so the editable `email`
-- and `phones` in the same row are preserved. The address itself is the corporate
-- fact from the brief, which must not be altered, so it is restored to exactly
-- that: Half-Mile, Limbe, Southwest Region, Cameroon.
--
-- The guard makes this a no-op on a database whose address is already correct, so
-- it is safe to re-run and does not churn `updated_at`.
-- =============================================================================

update public.site_settings
set value = jsonb_set(
  value,
  '{address}',
  jsonb_build_object(
    'street', 'Half-Mile',
    'city', 'Limbe',
    'region', 'Southwest Region',
    'country', 'Cameroon'
  ),
  true
)
where key = 'site.contact'
  and jsonb_typeof(value) = 'object'
  and value -> 'address' is distinct from jsonb_build_object(
    'street', 'Half-Mile',
    'city', 'Limbe',
    'region', 'Southwest Region',
    'country', 'Cameroon'
  );

-- Restates the original table comment with the correct locality, so the schema
-- documents the corporate fact a reader of the table needs.
comment on table public.site_settings is
  'Editable site configuration. Public rows may be read anonymously; the rest are admin-only. The head-office locality is Half-Mile, Limbe, Southwest Region, Cameroon.';
