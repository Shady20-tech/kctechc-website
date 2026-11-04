-- =============================================================================
-- Automatic translation index for insight articles.
--
-- The defect this fixes
-- --------------------
-- `'insight'` has been a member of `translatable_entity_type` since migration 1,
-- and the read path has always expected French rows: `loadInsightRecords` selects
-- from `content_translations` where `entity_type = 'insight'`, and
-- `localizeInsight` merges them over the canonical title/summary/body. Nothing
-- ever *wrote* those rows. Every other translatable entity has a
-- `sync_*_translation_index` trigger — products (migration 12), electrical
-- projects (migration 14), property listings (migration 22) and insight media
-- (migration 49) — but the article's own text never had one.
--
-- The visible effect: an article written and published by staff was stored once in
-- English. `/fr` then found no overlay, `resolveLocalized` fell back to the
-- canonical value, and the French page silently served English. There was no
-- `translation_entries` row, no `content_translations` row and no queued Tolgee
-- job, so nothing downstream could ever have translated it either.
--
-- Same contract as products and listings: writing an article never requires an
-- administrator to hand-create a Tolgee key. A trigger derives the translatable
-- fields, writes the index rows with deterministic keys, seeds the source value,
-- opens a `pending` French row, and queues durable sync work. The admin request
-- therefore completes without waiting on a remote Tolgee call, and a Tolgee outage
-- records a retryable failure instead of rolling back a valid article.
--
-- The trigger is the right place for the same reason it was for products: the
-- index becomes a property of the data, so an article written by a migration, a
-- seed, a psql session or the admin form is indexed too.
--
-- Scope of the field list
-- -----------------------
-- Only `title`, `summary` and `body` — exactly the fields `localizeInsight` merges
-- and `groupTranslations` understands. `slug` is deliberately excluded: the article
-- route resolves the canonical slug in both locales (`loadInsight` matches
-- `entry.slug`), and there is no `insight_slugs` table, so indexing a slug that is
-- never read would create Tolgee keys nothing consumes. The two `entity_seo`
-- fields the product and listing triggers index are excluded for the same reason:
-- `loadInsightRecords` does not read `entity_seo` for insights, so an SEO key here
-- would never render.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The translatable article fields, in one place.
--
-- A function rather than a literal list repeated in the trigger and in
-- TypeScript: adding a field is one row here plus the TypeScript constant, and
-- `keys.test.ts` asserts the two agree.
-- -----------------------------------------------------------------------------
create or replace function public.insight_translatable_fields()
returns text[]
language sql
immutable
as $$
  select array[
    'title',
    'summary',
    'body'
  ];
$$;

comment on function public.insight_translatable_fields is
  'The article fields indexed for translation. Must match INSIGHT_TRANSLATABLE_FIELDS in src/lib/translation/keys.ts.';

-- -----------------------------------------------------------------------------
-- Sync the translation index for one article.
--
-- Three behaviours, matching the product and listing implementations:
--
--   1. Idempotent — every write is an upsert on the natural key, so re-saving an
--      article updates the same rows.
--   2. An English source change marks the French value `outdated` and does NOT
--      overwrite it. A human translation is expensive, and silently replacing it
--      would destroy work and quietly ship English to French readers.
--   3. A missing French row is created as `pending`, so there is always a row to
--      hang the sync state on.
-- -----------------------------------------------------------------------------
create or replace function public.sync_insight_translation_index()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  field text;
  source_value text;
  entry_id uuid;
  existing_state public.translation_state;
  existing_source_updated timestamptz;
  -- Only English is a source locale; every other locale is a target.
  target_locales public.locale_code[] := array['fr']::public.locale_code[];
begin
  foreach field in array public.insight_translatable_fields() loop
    source_value := case field
      when 'title' then new.title
      when 'summary' then new.summary
      when 'body' then new.body
    end;

    -- A field with no source value is not translatable yet: clearing a summary
    -- should not produce an index row claiming it exists.
    continue when source_value is null or btrim(source_value) = '';

    -- --- Translation index row -------------------------------------------
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
      public.build_translation_key('insight', new.id, field, 'en'),
      'insight',
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
        -- sequence of admin saves does not stack redundant jobs.
        sync_state = case
          when public.translation_entries.sync_state in ('queued', 'syncing')
            then public.translation_entries.sync_state
          else 'queued'::public.sync_state
        end,
        error_message = null,
        updated_at = now()
    returning id into entry_id;

    -- --- Source-locale value ---------------------------------------------
    -- The English value is written as `translated`: it is the source text, so it
    -- is trivially translated into its own locale, and it gives the sync job one
    -- uniform place to read the source from.
    insert into public.content_translations (
      entity_type, entity_id, field_name, locale, value, state,
      source_locale, translated_at
    )
    values (
      'insight', new.id, field, 'en', source_value, 'translated', 'en', now()
    )
    on conflict (entity_type, entity_id, field_name, locale) do update
      set value = excluded.value,
          state = 'translated',
          updated_at = now();

    -- --- Target-locale value ---------------------------------------------
    select state, source_updated_at
    into existing_state, existing_source_updated
    from public.content_translations
    where entity_type = 'insight'
      and entity_id = new.id
      and field_name = field
      and locale = 'fr';

    if not found then
      insert into public.content_translations (
        entity_type, entity_id, field_name, locale, value, state,
        source_locale, source_updated_at
      )
      values (
        'insight', new.id, field, 'fr', '', 'pending', 'en', now()
      );
    elsif existing_state in ('translated', 'reviewed')
          and (existing_source_updated is null
               or existing_source_updated < new.updated_at) then
      -- A real translation exists and the English text has moved on. Mark it
      -- outdated and keep the text; do not overwrite it.
      update public.content_translations
      set state = 'outdated', source_updated_at = new.updated_at
      where entity_type = 'insight'
        and entity_id = new.id
        and field_name = field
        and locale = 'fr';
    else
      update public.content_translations
      set source_updated_at = new.updated_at
      where entity_type = 'insight'
        and entity_id = new.id
        and field_name = field
        and locale = 'fr';
    end if;

    -- --- Durable sync job ------------------------------------------------
    -- One queued job per entry. A partially-failed queue should not accumulate
    -- duplicates for the same key, so an existing open job is reused.
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
          'key', public.build_translation_key('insight', new.id, field, 'en'),
          'entityType', 'insight',
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

comment on function public.sync_insight_translation_index is
  'Idempotent translation-index maintenance for an insight article. Marks French values outdated rather than overwriting them when English changes.';

-- Fires on insert, and on update only when a field that feeds the index changed.
-- Restricting the UPDATE columns keeps a publish-state or category change from
-- re-queuing three translation jobs that have no new source text.
create trigger insights_sync_translation_index
  after insert or update of
    title, summary, body
  on public.insights
  for each row execute function public.sync_insight_translation_index();

-- -----------------------------------------------------------------------------
-- Backfill existing articles.
--
-- Every article written before this migration has no index rows, so without a
-- backfill it would stay English forever even after the trigger exists. The
-- backfill creates only what is missing: an existing French translation is left
-- untouched by the `do nothing` conflict clauses.
--
-- Jobs are enqueued only for entries this backfill created (the `created` CTE),
-- so re-running it cannot re-push an article whose translation is already synced.
--
-- The field set is written out rather than read from `insight_translatable_fields()`
-- because a set-based statement needs a `case` to resolve each field to its column.
-- This runs once, so it cannot drift from the function the way a runtime path could.
-- -----------------------------------------------------------------------------
with created as (
  insert into public.translation_entries (
    translation_key, entity_type, entity_id, field_name,
    source_locale, target_locales, state, sync_state
  )
  select
    public.build_translation_key('insight', i.id, f.field_name, 'en'),
    'insight',
    i.id,
    f.field_name,
    'en',
    array['fr']::public.locale_code[],
    'pending',
    'queued'
  from public.insights i
  cross join unnest(array['title', 'summary', 'body']) as f (field_name)
  where btrim(coalesce(
    case f.field_name
      when 'title' then i.title
      when 'summary' then i.summary
      when 'body' then i.body
    end, '')) <> ''
  on conflict (translation_key) do nothing
  returning id, translation_key, entity_id, field_name
)
insert into public.translation_sync_jobs (
  translation_entry_id, job_type, status, payload
)
select
  c.id,
  'tolgee_push',
  'queued',
  jsonb_build_object(
    'key', c.translation_key,
    'entityType', 'insight',
    'entityId', c.entity_id,
    'field', c.field_name,
    'sourceLocale', 'en',
    'targetLocales', array['fr']
  )
from created c;

-- The canonical English text, so the sync job has a source value to read. This
-- mirrors the trigger and is idempotent: the source is authoritative, so an
-- existing row is brought up to date rather than skipped.
insert into public.content_translations (
  entity_type, entity_id, field_name, locale, value, state,
  source_locale, translated_at
)
select
  'insight', i.id, f.field_name, 'en',
  case f.field_name
    when 'title' then i.title
    when 'summary' then i.summary
    when 'body' then i.body
  end,
  'translated', 'en', now()
from public.insights i
cross join unnest(array['title', 'summary', 'body']) as f (field_name)
where btrim(coalesce(
  case f.field_name
    when 'title' then i.title
    when 'summary' then i.summary
    when 'body' then i.body
  end, '')) <> ''
on conflict (entity_type, entity_id, field_name, locale) do update
  set value = excluded.value,
      state = 'translated',
      updated_at = now();

-- A `pending` French row for each field, so an untranslated article is visible as
-- untranslated rather than absent. `do nothing` on conflict is what guarantees an
-- existing French translation is never destroyed by this migration.
insert into public.content_translations (
  entity_type, entity_id, field_name, locale, value, state,
  source_locale, source_updated_at
)
select
  'insight', i.id, f.field_name, 'fr', '', 'pending', 'en', now()
from public.insights i
cross join unnest(array['title', 'summary', 'body']) as f (field_name)
where btrim(coalesce(
  case f.field_name
    when 'title' then i.title
    when 'summary' then i.summary
    when 'body' then i.body
  end, '')) <> ''
on conflict (entity_type, entity_id, field_name, locale) do nothing;

-- -----------------------------------------------------------------------------
-- Grants.
--
-- Supabase grants EXECUTE on a new `public` function to `anon`/`authenticated` by
-- default, and the Phase 12 hardening migration (41) ran before this one created
-- these functions — so it did not revoke them. The revoke is repeated here rather
-- than assumed, because `30_function_execute_hardening.sql` asserts the *subset*
-- property: any non-trigger function reachable by a browser key that is not on the
-- allow-list fails that check. `insight_translatable_fields()` is not a trigger
-- function, so without this revoke the validation harness would (correctly) fail.
--
-- `service_role` keeps both: a maintenance path may invoke the sync function, and
-- the trigger itself runs as the function owner, so neither needs a browser grant.
-- -----------------------------------------------------------------------------
revoke all on function public.insight_translatable_fields() from public;
revoke all on function public.insight_translatable_fields() from anon, authenticated;
grant execute on function public.insight_translatable_fields() to service_role;

revoke all on function public.sync_insight_translation_index() from public;
revoke all on function public.sync_insight_translation_index() from anon, authenticated;
grant execute on function public.sync_insight_translation_index() to service_role;
