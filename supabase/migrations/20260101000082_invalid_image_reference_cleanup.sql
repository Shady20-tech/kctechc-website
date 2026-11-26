-- =============================================================================
-- Remove invalid external image references.
--
-- Every public image URL in this application is derived from a Storage object
-- path. An absolute URL such as `https://imgur.com/undefined` is not an object in
-- any bucket, so a row holding one can only render a broken image (or a request
-- to an unrelated host). This migration repairs rows written before the media
-- tables gained their relative-path constraints, and guards the image columns
-- that have no such constraint — avatar, article cover, agent photo, SEO image
-- and listing evidence.
--
-- It deliberately does not rewrite prose (descriptions, article bodies). A URL
-- pasted into prose is content, not an image reference, and silently deleting
-- part of it would be a worse outcome than leaving the author's words intact.
-- =============================================================================

-- A published product must keep at least one valid photograph. If every media
-- row attached to it is invalid, step it back to draft before removing those
-- rows, because a published row with no media violates the store's own rule.
update public.products p
set publish_state = 'draft'
where p.publish_state = 'published'
  and exists (
    select 1
    from public.product_media m
    where m.product_id = p.id
      and (
        m.storage_path ~* '^[a-z][a-z0-9+.-]*://'
        or m.storage_path ~* 'imgur\.com/undefined'
        or m.storage_path = 'undefined'
      )
  )
  and not exists (
    select 1
    from public.product_media m
    where m.product_id = p.id
      and not (
        m.storage_path ~* '^[a-z][a-z0-9+.-]*://'
        or m.storage_path ~* 'imgur\.com/undefined'
        or m.storage_path = 'undefined'
      )
  );

-- Media rows that cannot name an object in their bucket are removed. The buckets
-- are derived from these paths, so keeping the row would only preserve a broken
-- image for the editor to puzzle over.
delete from public.product_media
where storage_path ~* '^[a-z][a-z0-9+.-]*://'
   or storage_path ~* 'imgur\.com/undefined'
   or storage_path = 'undefined';

delete from public.listing_media
where storage_path ~* '^[a-z][a-z0-9+.-]*://'
   or storage_path ~* 'imgur\.com/undefined'
   or storage_path = 'undefined';

delete from public.project_media
where storage_path ~* '^[a-z][a-z0-9+.-]*://'
   or storage_path ~* 'imgur\.com/undefined'
   or storage_path = 'undefined';

delete from public.insight_media
where storage_path ~* '^[a-z][a-z0-9+.-]*://'
   or storage_path ~* 'imgur\.com/undefined'
   or storage_path = 'undefined';

-- Single-image references have no child row to delete, so the invalid value is
-- cleared and the surface falls back to its placeholder.
update public.profiles
set avatar_path = null
where avatar_path ~* '^[a-z][a-z0-9+.-]*://'
   or avatar_path ~* 'imgur\.com/undefined'
   or avatar_path = 'undefined';

update public.agent_profiles
set photo_path = null
where photo_path ~* '^[a-z][a-z0-9+.-]*://'
   or photo_path ~* 'imgur\.com/undefined'
   or photo_path = 'undefined';

update public.insights
set cover_image_path = null
where cover_image_path ~* '^[a-z][a-z0-9+.-]*://'
   or cover_image_path ~* 'imgur\.com/undefined'
   or cover_image_path = 'undefined';

update public.listing_submissions
set evidence_path = null
where evidence_path ~* '^[a-z][a-z0-9+.-]*://'
   or evidence_path ~* 'imgur\.com/undefined'
   or evidence_path = 'undefined';

update public.entity_seo
set og_image_path = null
where og_image_path ~* '^[a-z][a-z0-9+.-]*://'
   or og_image_path ~* 'imgur\.com/undefined'
   or og_image_path = 'undefined';

update public.seo_metadata
set og_image_path = null
where og_image_path ~* '^[a-z][a-z0-9+.-]*://'
   or og_image_path ~* 'imgur\.com/undefined'
   or og_image_path = 'undefined';

-- Settings are JSON, so the invalid string is removed wherever it appears while
-- preserving the surrounding structure. The first pass catches the full URL and
-- the second catches a bare `imgur.com/undefined`, so the guard below cannot be
-- defeated by a variant the cleanup did not match.
update public.site_settings
set value = regexp_replace(
  regexp_replace(value::text, 'https?://imgur\.com/undefined', '', 'gi'),
  'imgur\.com/undefined',
  '',
  'gi'
)::jsonb
where value::text ~* 'imgur\.com/undefined';

-- The unconstrained image columns get a narrow guard so the same value cannot be
-- written back by a manual console edit. The media tables already constrain
-- storage_path to a relative object path.
alter table public.profiles
  drop constraint if exists profiles_avatar_path_not_imgur_undefined,
  add constraint profiles_avatar_path_not_imgur_undefined
  check (avatar_path is null or avatar_path !~* 'imgur\.com/undefined');

alter table public.agent_profiles
  drop constraint if exists agent_profiles_photo_path_not_imgur_undefined,
  add constraint agent_profiles_photo_path_not_imgur_undefined
  check (photo_path is null or photo_path !~* 'imgur\.com/undefined');

alter table public.insights
  drop constraint if exists insights_cover_path_not_imgur_undefined,
  add constraint insights_cover_path_not_imgur_undefined
  check (cover_image_path is null or cover_image_path !~* 'imgur\.com/undefined');

alter table public.entity_seo
  drop constraint if exists entity_seo_og_image_not_imgur_undefined,
  add constraint entity_seo_og_image_not_imgur_undefined
  check (og_image_path is null or og_image_path !~* 'imgur\.com/undefined');

alter table public.seo_metadata
  drop constraint if exists seo_metadata_og_image_not_imgur_undefined,
  add constraint seo_metadata_og_image_not_imgur_undefined
  check (og_image_path is null or og_image_path !~* 'imgur\.com/undefined');

alter table public.site_settings
  drop constraint if exists site_settings_no_imgur_undefined,
  add constraint site_settings_no_imgur_undefined
  check (value::text !~* 'imgur\.com/undefined');

-- Fail the migration rather than recording a partial repair. A value left behind
-- would keep rendering a broken image on the surface that owns the column.
do $$
declare
  remaining integer;
begin
  select count(*) into remaining
  from (
    select 1 from public.profiles where avatar_path ~* 'imgur\.com/undefined'
    union all
    select 1 from public.agent_profiles where photo_path ~* 'imgur\.com/undefined'
    union all
    select 1 from public.insights where cover_image_path ~* 'imgur\.com/undefined'
    union all
    select 1 from public.listing_submissions where evidence_path ~* 'imgur\.com/undefined'
    union all
    select 1 from public.entity_seo where og_image_path ~* 'imgur\.com/undefined'
    union all
    select 1 from public.seo_metadata where og_image_path ~* 'imgur\.com/undefined'
    union all
    select 1 from public.site_settings where value::text ~* 'imgur\.com/undefined'
    union all
    select 1 from public.product_media where storage_path ~* 'imgur\.com/undefined'
    union all
    select 1 from public.listing_media where storage_path ~* 'imgur\.com/undefined'
    union all
    select 1 from public.project_media where storage_path ~* 'imgur\.com/undefined'
    union all
    select 1 from public.insight_media where storage_path ~* 'imgur\.com/undefined'
  ) as bad;

  if remaining > 0 then
    raise exception 'invalid image references remain after cleanup: %', remaining;
  end if;
end $$;
