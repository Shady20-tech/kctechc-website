-- =============================================================================
-- Phase 6 — Automatic translation index for property listings and their media.
--
-- Requirement: "Property translation-index entries are generated automatically."
--
-- Same contract as products: creating or editing a listing never requires an
-- administrator to hand-create a Tolgee key. A trigger derives the translatable
-- fields, writes the index rows with deterministic keys, and queues durable sync
-- work. The admin request therefore completes without waiting on a remote Tolgee
-- call, and a Tolgee outage records a retryable failure instead of rolling back a
-- valid listing.
--
-- The trigger is the right place for the same reason it was for products: the
-- index becomes a property of the data. A listing written by a migration, a seed,
-- a psql session or the CSV importer is indexed too, so a code path that forgets
-- to call a helper cannot create an unindexed listing.
--
-- `property_media` alt text gets the same treatment, keyed on the media row.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The translatable listing fields, in one place.
--
-- A function rather than a literal list repeated in the trigger and in
-- TypeScript: adding a field is one row here plus the TypeScript constant, and a
-- test asserts the two agree.
-- -----------------------------------------------------------------------------
create or replace function public.property_translatable_fields()
returns text[]
language sql
immutable
as $$
  select array[
    'title',
    'description',
    'highlights',
    'slug',
    'seo_title',
    'seo_description'
  ];
$$;

comment on function public.property_translatable_fields is
  'The listing fields indexed for translation. Must match PROPERTY_TRANSLATABLE_FIELDS in src/lib/translation/keys.ts.';

-- -----------------------------------------------------------------------------
-- Sync the translation index for one listing.
--
-- Three behaviours, matching the product implementation:
--
--   1. Idempotent — every write is an upsert on the natural key, so re-saving a
--      listing updates the same rows.
--   2. An English source change marks the French value `outdated` and does NOT
--      overwrite it. A human translation is expensive, and silently replacing it
--      would destroy work and quietly ship English to French readers.
--   3. A missing French row is created as `pending`, so there is always a row to
--      hang the sync state on.
--
-- `highlights` is an array and is joined with newlines rather than spaces: a
-- highlight is a phrase, and joining with a space would merge two bullets into
-- one sentence for the translator.
-- -----------------------------------------------------------------------------
create or replace function public.sync_property_translation_index()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  field text;
  source_value text;
  seo_title text;
  seo_description text;
  entry_id uuid;
  existing_state public.translation_state;
  existing_source_updated timestamptz;
  target_locales public.locale_code[] := array['fr']::public.locale_code[];
begin
  -- Resolve the per-locale SEO overrides once, so the seo_title/seo_description
  -- index rows carry the value the page will actually render rather than a
  -- recomputed approximation of it.
  select title, description
  into seo_title, seo_description
  from public.entity_seo
  where entity_type = 'property_listing' and entity_id = new.id and locale = 'en';

  foreach field in array public.property_translatable_fields() loop
    source_value := case field
      when 'title' then new.title
      when 'description' then new.description
      when 'highlights' then array_to_string(new.highlights, E'\n')
      when 'slug' then new.slug
      when 'seo_title' then seo_title
      when 'seo_description' then seo_description
    end;

    -- A field with no source value is not translatable yet: an SEO description
    -- that was never written should not produce an index row claiming it exists.
    continue when source_value is null or btrim(source_value) = '';

    insert into public.translation_entries (
      translation_key,
      entity_type,
      entity_id,
      field_name,
      source_locale,
      target_locales,
      state,
      sync_state
    )
    values (
      public.build_translation_key('property_listing', new.id, field, 'en'),
      'property_listing',
      new.id,
      field,
      'en',
      target_locales,
      'pending',
      'queued'
    )
    on conflict (translation_key) do update
      set
        -- Re-queue only when the entry is not already in flight, so a rapid
        -- sequence of saves does not stack redundant jobs.
        sync_state = case
          when public.translation_entries.sync_state in ('queued', 'syncing')
            then public.translation_entries.sync_state
          else 'queued'::public.sync_state
        end,
        error_message = null,
        updated_at = now()
    returning id into entry_id;

    -- The English value is written as `translated`: it is the source text, so it
    -- is trivially translated into its own locale, and it gives the sync job one
    -- uniform place to read the source from.
    insert into public.content_translations (
      entity_type, entity_id, field_name, locale, value, state,
      source_locale, translated_at
    )
    values (
      'property_listing', new.id, field, 'en', source_value,
      'translated', 'en', now()
    )
    on conflict (entity_type, entity_id, field_name, locale) do update
      set value = excluded.value,
          state = 'translated',
          updated_at = now();

    select state, source_updated_at
    into existing_state, existing_source_updated
    from public.content_translations
    where entity_type = 'property_listing'
      and entity_id = new.id
      and field_name = field
      and locale = 'fr';

    if not found then
      insert into public.content_translations (
        entity_type, entity_id, field_name, locale, value, state,
        source_locale, source_updated_at
      )
      values (
        'property_listing', new.id, field, 'fr', '', 'pending', 'en', now()
      );
    elsif existing_state in ('translated', 'reviewed')
          and (existing_source_updated is null
               or existing_source_updated < new.updated_at) then
      -- A real translation exists and the English text has moved on. Mark it
      -- outdated and keep the text; do not overwrite it.
      update public.content_translations
      set state = 'outdated', source_updated_at = new.updated_at
      where entity_type = 'property_listing'
        and entity_id = new.id
        and field_name = field
        and locale = 'fr';
    else
      update public.content_translations
      set source_updated_at = new.updated_at
      where entity_type = 'property_listing'
        and entity_id = new.id
        and field_name = field
        and locale = 'fr';
    end if;

    -- One queued job per entry: a partially-failed queue should not accumulate
    -- duplicates for the same key.
    if not exists (
      select 1 from public.translation_sync_jobs j
      where j.translation_entry_id = entry_id
        and j.status in ('queued', 'syncing')
    ) then
      insert into public.translation_sync_jobs (
        translation_entry_id, job_type, status, payload
      )
      values (
        entry_id,
        'tolgee_push',
        'queued',
        jsonb_build_object(
          'key', public.build_translation_key('property_listing', new.id, field, 'en'),
          'entityType', 'property_listing',
          'entityId', new.id,
          'field', field,
          'sourceLocale', 'en',
          'targetLocales', target_locales
        )
      );
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.sync_property_translation_index is
  'Idempotent translation-index maintenance for a listing. Marks French values outdated rather than overwriting them when English changes.';

-- Fires on insert, and on update only when a field that feeds the index changed.
-- Restricting the UPDATE columns keeps a price or status change from re-queuing
-- six translation jobs that have no new source text.
create trigger property_listings_sync_translation_index
  after insert or update of
    title, description, highlights, slug
  on public.property_listings
  for each row execute function public.sync_property_translation_index();

-- -----------------------------------------------------------------------------
-- Listing media alt text.
-- -----------------------------------------------------------------------------
create or replace function public.sync_listing_media_translation_index()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entry_id uuid;
  existing_state public.translation_state;
begin
  insert into public.translation_entries (
    translation_key, entity_type, entity_id, field_name,
    source_locale, target_locales, state, sync_state
  )
  values (
    public.build_translation_key('property_media', new.id, 'alt_text', 'en'),
    'property_media',
    new.id,
    'alt_text',
    'en',
    array['fr']::public.locale_code[],
    'pending',
    'queued'
  )
  on conflict (translation_key) do update
    set sync_state = case
          when public.translation_entries.sync_state in ('queued', 'syncing')
            then public.translation_entries.sync_state
          else 'queued'::public.sync_state
        end,
        error_message = null,
        updated_at = now()
  returning id into entry_id;

  insert into public.content_translations (
    entity_type, entity_id, field_name, locale, value, state,
    source_locale, translated_at
  )
  values (
    'property_media', new.id, 'alt_text', 'en', new.alt_text,
    'translated', 'en', now()
  )
  on conflict (entity_type, entity_id, field_name, locale) do update
    set value = excluded.value, state = 'translated', updated_at = now();

  select state into existing_state
  from public.content_translations
  where entity_type = 'property_media'
    and entity_id = new.id
    and field_name = 'alt_text'
    and locale = 'fr';

  if not found then
    insert into public.content_translations (
      entity_type, entity_id, field_name, locale, value, state,
      source_locale, source_updated_at
    )
    values (
      'property_media', new.id, 'alt_text', 'fr', '', 'pending', 'en', now()
    );
  elsif existing_state in ('translated', 'reviewed') then
    update public.content_translations
    set state = 'outdated', source_updated_at = now()
    where entity_type = 'property_media'
      and entity_id = new.id
      and field_name = 'alt_text'
      and locale = 'fr';
  end if;

  if not exists (
    select 1 from public.translation_sync_jobs j
    where j.translation_entry_id = entry_id and j.status in ('queued', 'syncing')
  ) then
    insert into public.translation_sync_jobs (
      translation_entry_id, job_type, status, payload
    )
    values (
      entry_id,
      'tolgee_push',
      'queued',
      jsonb_build_object(
        'key', public.build_translation_key('property_media', new.id, 'alt_text', 'en'),
        'entityType', 'property_media',
        'entityId', new.id,
        'field', 'alt_text',
        'sourceLocale', 'en',
        'targetLocales', array['fr']::public.locale_code[]
      )
    );
  end if;

  return new;
end;
$$;

create trigger listing_media_sync_translation_index
  after insert or update of alt_text on public.listing_media
  for each row execute function public.sync_listing_media_translation_index();

-- -----------------------------------------------------------------------------
-- Localized slug maintenance.
--
-- A localized slug is both a URL segment and a translatable value. Writing the
-- French slug must therefore also record it in `content_translations`, so the
-- translation index and the routing table agree about what the French slug is.
-- -----------------------------------------------------------------------------
create or replace function public.sync_listing_slug_translation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entry_id uuid;
begin
  insert into public.content_translations (
    entity_type, entity_id, field_name, locale, value, state,
    source_locale, translated_at
  )
  values (
    'property_listing', new.listing_id, 'slug', new.locale, new.slug,
    'translated', 'en', now()
  )
  on conflict (entity_type, entity_id, field_name, locale) do update
    set value = excluded.value, state = 'translated', updated_at = now();

  insert into public.translation_entries (
    translation_key, entity_type, entity_id, field_name,
    source_locale, target_locales, state, sync_state
  )
  values (
    public.build_translation_key('property_listing', new.listing_id, 'slug', 'en'),
    'property_listing',
    new.listing_id,
    'slug',
    'en',
    array[new.locale],
    'translated',
    'queued'
  )
  on conflict (translation_key) do update
    set sync_state = case
          when public.translation_entries.sync_state in ('queued', 'syncing')
            then public.translation_entries.sync_state
          else 'queued'::public.sync_state
        end,
        error_message = null,
        updated_at = now()
  returning id into entry_id;

  if not exists (
    select 1 from public.translation_sync_jobs j
    where j.translation_entry_id = entry_id and j.status in ('queued', 'syncing')
  ) then
    insert into public.translation_sync_jobs (
      translation_entry_id, job_type, status, payload
    )
    values (
      entry_id,
      'tolgee_push',
      'queued',
      jsonb_build_object(
        'key', public.build_translation_key('property_listing', new.listing_id, 'slug', 'en'),
        'entityType', 'property_listing',
        'entityId', new.listing_id,
        'field', 'slug',
        'sourceLocale', 'en',
        'targetLocales', array[new.locale]
      )
    );
  end if;

  return new;
end;
$$;

create trigger listing_slugs_sync_translation
  after insert or update of slug on public.listing_slugs
  for each row execute function public.sync_listing_slug_translation();

-- -----------------------------------------------------------------------------
-- SEO overrides feed the index.
--
-- entity_seo rows are written separately from the listing, so an English SEO
-- title arriving later must update the index too. Without this trigger the
-- seo_title key would only ever be created when the listing was first saved, and
-- a later SEO edit would never reach Tolgee.
-- -----------------------------------------------------------------------------
create or replace function public.sync_property_seo_translation_index()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  field text;
  source_value text;
  entry_id uuid;
begin
  if new.entity_type <> 'property_listing' then
    return new;
  end if;

  foreach field in array array['seo_title', 'seo_description'] loop
    source_value := case field
      when 'seo_title' then new.title
      when 'seo_description' then new.description
    end;

    continue when source_value is null or btrim(source_value) = '';

    insert into public.translation_entries (
      translation_key, entity_type, entity_id, field_name,
      source_locale, target_locales, state, sync_state
    )
    values (
      public.build_translation_key('property_listing', new.entity_id, field, 'en'),
      'property_listing', new.entity_id, field, 'en',
      array['fr']::public.locale_code[], 'pending', 'queued'
    )
    on conflict (translation_key) do update
      set sync_state = case
            when public.translation_entries.sync_state in ('queued', 'syncing')
              then public.translation_entries.sync_state
            else 'queued'::public.sync_state
          end,
          error_message = null,
          updated_at = now()
    returning id into entry_id;

    insert into public.content_translations (
      entity_type, entity_id, field_name, locale, value, state,
      source_locale, translated_at
    )
    values (
      'property_listing', new.entity_id, field, new.locale, source_value,
      'translated', 'en', now()
    )
    on conflict (entity_type, entity_id, field_name, locale) do update
      set value = excluded.value, state = 'translated', updated_at = now();

    if not exists (
      select 1 from public.translation_sync_jobs j
      where j.translation_entry_id = entry_id
        and j.status in ('queued', 'syncing')
    ) then
      insert into public.translation_sync_jobs (
        translation_entry_id, job_type, status, payload
      )
      values (
        entry_id,
        'tolgee_push',
        'queued',
        jsonb_build_object(
          'key', public.build_translation_key('property_listing', new.entity_id, field, 'en'),
          'entityType', 'property_listing',
          'entityId', new.entity_id,
          'field', field,
          'sourceLocale', 'en',
          'targetLocales', array['fr']::public.locale_code[]
        )
      );
    end if;
  end loop;

  return new;
end;
$$;

create trigger entity_seo_sync_property_translation_index
  after insert or update of title, description on public.entity_seo
  for each row execute function public.sync_property_seo_translation_index();
