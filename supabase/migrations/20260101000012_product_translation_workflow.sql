-- =============================================================================
-- Phase 4 — Automatic product translation index and sync workflow.
--
-- The contract: creating or updating a product never requires an admin to
-- hand-create a Tolgee key. A trigger derives the translatable fields, writes the
-- index rows with deterministic keys, and queues durable sync work. The admin
-- request therefore completes without waiting on a remote Tolgee call, and a
-- Tolgee outage records a retryable failure instead of rolling back a valid
-- product.
--
-- Why the index is populated by a trigger rather than by application code:
--   * The index is then a property of the data. A product inserted by a
--     migration, a seed, a psql session or a future import job is indexed too —
--     a code path that forgets to call a helper cannot create an unindexed
--     product.
--   * It is idempotent by construction: the upsert keys on
--     (entity_type, entity_id, field_name), so re-saving a product updates the
--     same rows instead of adding new ones.
--
-- `translation_entries.translation_key` is UNIQUE and its format check requires
-- `entity_type.entity_id.field_name.locale`, which the generator below satisfies
-- exactly. That uniqueness is the final guarantee against duplicate keys.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Deterministic key generation.
--
-- One function so the key format lives in exactly one place. `entity_type` is
-- part of the key, so a product and a service sharing a uuid could never collide.
-- -----------------------------------------------------------------------------
create or replace function public.build_translation_key(
  p_entity_type public.translatable_entity_type,
  p_entity_id uuid,
  p_field_name text,
  p_locale public.locale_code
)
returns text
language sql
immutable
as $$
  select
    p_entity_type::text || '.' || p_entity_id::text || '.'
    || p_field_name || '.' || p_locale::text;
$$;

comment on function public.build_translation_key is
  'Deterministic Tolgee key: entity_type.entity_id.field_name.locale. Mirrors buildTranslationKey() in src/lib/translation/keys.ts.';

-- -----------------------------------------------------------------------------
-- The translatable product fields, in one place.
--
-- A table rather than a literal list repeated in the trigger and in TypeScript:
-- adding a field is one row here plus the TypeScript constant, and the
-- determinism test asserts the two agree.
-- -----------------------------------------------------------------------------
create or replace function public.product_translatable_fields()
returns text[]
language sql
immutable
as $$
  select array[
    'name',
    'short_description',
    'description',
    'slug',
    'seo_title',
    'seo_description'
  ];
$$;

comment on function public.product_translatable_fields is
  'The product fields indexed for translation. Must match PRODUCT_TRANSLATABLE_FIELDS in src/lib/translation/keys.ts.';

-- -----------------------------------------------------------------------------
-- Sync the translation index for one product.
--
-- Called by trigger on insert and on update of any translatable field. Three
-- behaviours matter:
--
--   1. Idempotent. Every write is an upsert on the natural key, so running it
--      twice changes nothing the second time.
--   2. An English source change marks the French value `outdated` and does NOT
--      overwrite it. A human translation is expensive; silently replacing it with
--      the new English text would destroy work and quietly ship English to French
--      readers. Marking it outdated surfaces the work instead.
--   3. A missing French row is created as `pending` so there is always a row to
--      hang the sync state on, and its state records that the translation is owed.
--
-- The English value is also written to `content_translations` as `translated`:
-- it is the source text, so it is trivially "translated" into its own locale, and
-- it gives the sync job one uniform place to read the source value from.
-- -----------------------------------------------------------------------------
create or replace function public.sync_product_translation_index()
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
  -- Only English is a source locale; every other locale is a target.
  target_locales public.locale_code[] := array['fr']::public.locale_code[];
begin
  -- Resolve the per-locale SEO overrides once, so the seo_title / seo_description
  -- index rows carry the value the page will actually render rather than a
  -- recomputed approximation of it.
  select title, description
  into seo_title, seo_description
  from public.entity_seo
  where entity_type = 'product' and entity_id = new.id and locale = 'en';

  foreach field in array public.product_translatable_fields() loop
    source_value := case field
      when 'name' then new.title
      when 'short_description' then new.short_description
      when 'description' then new.description
      when 'slug' then new.slug
      when 'seo_title' then seo_title
      when 'seo_description' then seo_description
    end;

    -- A field with no source value is not translatable yet: an SEO description
    -- that was never written should not produce an index row claiming it exists.
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
      public.build_translation_key('product', new.id, field, 'en'),
      'product',
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
    insert into public.content_translations (
      entity_type, entity_id, field_name, locale, value, state,
      source_locale, translated_at
    )
    values (
      'product', new.id, field, 'en', source_value, 'translated', 'en', now()
    )
    on conflict (entity_type, entity_id, field_name, locale) do update
      set value = excluded.value,
          state = 'translated',
          updated_at = now();

    -- --- Target-locale value ---------------------------------------------
    select state, source_updated_at
    into existing_state, existing_source_updated
    from public.content_translations
    where entity_type = 'product'
      and entity_id = new.id
      and field_name = field
      and locale = 'fr';

    if not found then
      insert into public.content_translations (
        entity_type, entity_id, field_name, locale, value, state,
        source_locale, source_updated_at
      )
      values (
        'product', new.id, field, 'fr', '', 'pending', 'en', now()
      );
    elsif existing_state in ('translated', 'reviewed')
          and (existing_source_updated is null
               or existing_source_updated < new.updated_at) then
      -- A real translation exists and the English text has moved on. Mark it
      -- outdated and keep the text; do not overwrite it.
      update public.content_translations
      set state = 'outdated', source_updated_at = new.updated_at
      where entity_type = 'product'
        and entity_id = new.id
        and field_name = field
        and locale = 'fr';
    else
      update public.content_translations
      set source_updated_at = new.updated_at
      where entity_type = 'product'
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
          'key', public.build_translation_key('product', new.id, field, 'en'),
          'entityType', 'product',
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

comment on function public.sync_product_translation_index is
  'Idempotent translation-index maintenance for a product. Marks French values outdated rather than overwriting them when English changes.';

-- Fires on insert, and on update only when a field that feeds the index changed.
-- Restricting the UPDATE columns keeps an inventory or publish-state change from
-- re-queuing six translation jobs that have no new source text.
create trigger products_sync_translation_index
  after insert or update of
    title, short_description, description, slug
  on public.products
  for each row execute function public.sync_product_translation_index();

-- -----------------------------------------------------------------------------
-- Product media alt text.
--
-- Alt text is translatable, so it gets the same index treatment. It is keyed on
-- the media row, which is why the `product_media` entity type was added.
-- -----------------------------------------------------------------------------
create or replace function public.sync_product_media_translation_index()
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
    public.build_translation_key('product_media', new.id, 'alt_text', 'en'),
    'product_media',
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
    'product_media', new.id, 'alt_text', 'en', new.alt_text,
    'translated', 'en', now()
  )
  on conflict (entity_type, entity_id, field_name, locale) do update
    set value = excluded.value, state = 'translated', updated_at = now();

  select state into existing_state
  from public.content_translations
  where entity_type = 'product_media'
    and entity_id = new.id
    and field_name = 'alt_text'
    and locale = 'fr';

  if not found then
    insert into public.content_translations (
      entity_type, entity_id, field_name, locale, value, state,
      source_locale, source_updated_at
    )
    values (
      'product_media', new.id, 'alt_text', 'fr', '', 'pending', 'en', now()
    );
  elsif existing_state in ('translated', 'reviewed') then
    update public.content_translations
    set state = 'outdated', source_updated_at = now()
    where entity_type = 'product_media'
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
        'key', public.build_translation_key('product_media', new.id, 'alt_text', 'en'),
        'entityType', 'product_media',
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

create trigger product_media_sync_translation_index
  after insert or update of alt_text on public.product_media
  for each row execute function public.sync_product_media_translation_index();

-- -----------------------------------------------------------------------------
-- Localized product slug maintenance.
--
-- A localized slug is both a URL segment and a translatable value. Writing the
-- French slug must therefore also record it in content_translations, so the
-- translation index and the routing table agree about what the French slug is.
-- The `unique (locale, slug)` constraint on product_slugs is what stops two
-- products from claiming the same French URL.
-- -----------------------------------------------------------------------------
create or replace function public.sync_product_slug_translation()
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
    'product', new.product_id, 'slug', new.locale, new.slug,
    'translated', 'en', now()
  )
  on conflict (entity_type, entity_id, field_name, locale) do update
    set value = excluded.value, state = 'translated', updated_at = now();

  insert into public.translation_entries (
    translation_key, entity_type, entity_id, field_name,
    source_locale, target_locales, state, sync_state
  )
  values (
    public.build_translation_key('product', new.product_id, 'slug', 'en'),
    'product',
    new.product_id,
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
        'key', public.build_translation_key('product', new.product_id, 'slug', 'en'),
        'entityType', 'product',
        'entityId', new.product_id,
        'field', 'slug',
        'sourceLocale', 'en',
        'targetLocales', array[new.locale]
      )
    );
  end if;

  return new;
end;
$$;

create trigger product_slugs_sync_translation
  after insert or update of slug on public.product_slugs
  for each row execute function public.sync_product_slug_translation();

-- -----------------------------------------------------------------------------
-- SEO overrides feed the index.
--
-- entity_seo rows are written separately from the product, so an English SEO
-- title arriving later must update the index too. Without this trigger the
-- seo_title key would only ever be created when the product was first saved,
-- and a later SEO edit would never reach Tolgee.
-- -----------------------------------------------------------------------------
create or replace function public.sync_product_seo_translation_index()
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
  if new.entity_type <> 'product' then
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
      public.build_translation_key('product', new.entity_id, field, 'en'),
      'product', new.entity_id, field, 'en',
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
      'product', new.entity_id, field, new.locale, source_value,
      'translated', 'en', now()
    )
    on conflict (entity_type, entity_id, field_name, locale) do update
      set value = excluded.value, state = 'translated', updated_at = now();

    -- The SEO fields are indexed here rather than by the product trigger, so the
    -- queue entry has to be created here too. Without this the key would appear
    -- in the index and never be pushed to Tolgee.
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
          'key', public.build_translation_key('product', new.entity_id, field, 'en'),
          'entityType', 'product',
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

create trigger entity_seo_sync_product_translation_index
  after insert or update of title, description on public.entity_seo
  for each row execute function public.sync_product_seo_translation_index();

-- -----------------------------------------------------------------------------
-- Queue claim / complete / fail helpers.
--
-- The sync worker is a Supabase Edge Function that cannot hold a transaction
-- across an HTTP call to Tolgee. These functions give it atomic transitions so
-- two concurrent workers cannot claim the same job, and so a failure is recorded
-- with its retry decision rather than lost.
-- -----------------------------------------------------------------------------
create or replace function public.claim_translation_sync_jobs(p_limit integer default 20)
returns setof public.translation_sync_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- `for update skip locked` is what makes this safe to run concurrently: a
  -- second worker skips rows the first has claimed instead of blocking on them.
  return query
  update public.translation_sync_jobs j
  set status = 'syncing',
      started_at = now(),
      attempts = j.attempts + 1
  where j.id in (
    select id
    from public.translation_sync_jobs
    where status = 'queued' and scheduled_at <= now()
    order by scheduled_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning *;
end;
$$;

create or replace function public.complete_translation_sync_job(
  p_job_id uuid,
  p_tolgee_key_id text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.translation_sync_jobs
  set status = 'synced', finished_at = now(), last_error = null
  where id = p_job_id;

  update public.translation_entries
  set sync_state = 'synced',
      last_synced_at = now(),
      error_message = null,
      tolgee_key_id = coalesce(p_tolgee_key_id, tolgee_key_id)
  where id = (
    select translation_entry_id from public.translation_sync_jobs
    where id = p_job_id
  );
end;
$$;

/**
 * Record a failed attempt.
 *
 * Retries with exponential backoff until `max_attempts`, then parks the job as
 * `failed` with the error preserved. The product itself is untouched: a Tolgee
 * outage is a translation problem, not a reason to roll back valid catalogue
 * data.
 */
create or replace function public.fail_translation_sync_job(
  p_job_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job public.translation_sync_jobs;
begin
  select * into job from public.translation_sync_jobs where id = p_job_id;
  if not found then
    return;
  end if;

  if job.attempts < job.max_attempts then
    update public.translation_sync_jobs
    set status = 'queued',
        last_error = p_error,
        -- 2^attempts seconds, capped so a long outage does not schedule a retry
        -- hours away and then treat the job as abandoned.
        scheduled_at = now() + make_interval(
          secs => least(power(2, job.attempts)::integer, 3600)
        )
    where id = p_job_id;

    update public.translation_entries
    set sync_state = 'queued', error_message = p_error
    where id = job.translation_entry_id;
  else
    update public.translation_sync_jobs
    set status = 'failed', finished_at = now(), last_error = p_error
    where id = p_job_id;

    update public.translation_entries
    set sync_state = 'failed', error_message = p_error
    where id = job.translation_entry_id;
  end if;
end;
$$;

/**
 * Re-queue a failed entry by hand.
 *
 * The admin-visible recovery path: a failure that has exhausted its attempts is
 * retried on demand rather than requiring a database edit.
 */
create or replace function public.requeue_translation_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.translation_entries
  set sync_state = 'queued', error_message = null
  where id = p_entry_id;

  update public.translation_sync_jobs
  set status = 'queued',
      attempts = 0,
      scheduled_at = now(),
      started_at = null,
      finished_at = null
  where translation_entry_id = p_entry_id and status = 'failed';

  -- A failed entry whose job row was deleted still needs work to do.
  if not exists (
    select 1 from public.translation_sync_jobs
    where translation_entry_id = p_entry_id
  ) then
    insert into public.translation_sync_jobs (
      translation_entry_id, job_type, status
    )
    values (p_entry_id, 'tolgee_push', 'queued');
  end if;
end;
$$;

comment on function public.claim_translation_sync_jobs is
  'Atomically claim queued jobs for a worker. Safe to run concurrently (for update skip locked).';
comment on function public.fail_translation_sync_job is
  'Record a failed attempt with exponential backoff. Never rolls back the product.';

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.product_categories enable row level security;
alter table public.products enable row level security;

-- The queue helpers are SECURITY DEFINER, so they need explicit execute grants
-- for the roles that call them: the Edge Function runs as service_role.
revoke all on function public.claim_translation_sync_jobs(integer) from public;
revoke all on function public.complete_translation_sync_job(uuid, text) from public;
revoke all on function public.fail_translation_sync_job(uuid, text) from public;
revoke all on function public.requeue_translation_entry(uuid) from public;

grant execute on function public.claim_translation_sync_jobs(integer) to service_role;
grant execute on function public.complete_translation_sync_job(uuid, text) to service_role;
grant execute on function public.fail_translation_sync_job(uuid, text) to service_role;
grant execute on function public.requeue_translation_entry(uuid) to service_role, authenticated;
