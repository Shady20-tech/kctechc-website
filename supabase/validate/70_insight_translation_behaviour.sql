-- =============================================================================
-- Behavioural validation of the insight translation index.
--
-- Run after the migrations, on the harness created by `00_supabase_shim.sql`.
-- This proves the behaviour introduced in
-- `20260101000053_insight_translation_index.sql`:
--
--   * publishing or editing an article creates a deterministic index entry and a
--     queued Tolgee job for each translatable field, with no administrator
--     hand-creating a key;
--   * the canonical English text is stored as `translated` in
--     `content_translations`, and a `pending` French row exists to receive it;
--   * re-saving the same article is idempotent — one entry per field, not a
--     growing pile of duplicates;
--   * editing the English text marks an existing French translation `outdated`
--     and does NOT overwrite it, so a human translation is never destroyed;
--   * an empty field produces no index entry.
--
-- The defect this guards against: `'insight'` was a valid
-- `translatable_entity_type` and the read path (`loadInsightRecords` +
-- `localizeInsight`) already merged French rows, but nothing ever wrote them, so
-- `/fr` silently served English for every staff-written article.
--
-- Note: psql `:'var'` interpolation does NOT happen inside dollar-quoted `DO`
-- bodies, so values are looked up by subquery within those blocks.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Fixtures: an author and one published article.
--
-- The author is required by `insights_published_requires_author_and_date`, so it
-- is created first. The article is inserted directly rather than through the
-- admin action because this file proves the *database* behaviour, which is what
-- holds no matter which code path performs the write.
-- -----------------------------------------------------------------------------
insert into public.authors (slug, display_name, role_title)
values ('validation-author', 'Validation Author', 'Engineer')
on conflict (slug) do nothing;

insert into public.insights (
  slug, title, summary, body, publish_state, published_at, author_id
)
select
  'validation-insight',
  'Solar maintenance in the Southwest',
  'Why planned inspection beats reactive repair.',
  'A breaker that trips repeatedly is telling you something about the installation.',
  'published',
  now(),
  a.id
from public.authors a
where a.slug = 'validation-author'
on conflict (slug) do nothing;

do $$
declare
  v_insight_id uuid;
  v_author_id uuid;
  v_entry_count integer;
  v_job_count integer;
  v_en_value text;
  v_en_state public.translation_state;
  v_fr_state public.translation_state;
  v_fr_value text;
  v_empty_id uuid;
  v_empty_count integer;
begin
  select id into v_insight_id from public.insights where slug = 'validation-insight';
  if v_insight_id is null then
    raise exception 'VALIDATION FAIL: the fixture article was not created';
  end if;

  -- ---------------------------------------------------------------------------
  -- 1. Every translatable field got an index entry, with a deterministic key.
  -- ---------------------------------------------------------------------------
  select count(*) into v_entry_count
    from public.translation_entries
   where entity_type = 'insight' and entity_id = v_insight_id;

  if v_entry_count <> 3 then
    raise exception
      'VALIDATION FAIL: expected 3 insight translation entries (title, summary, body), found %',
      v_entry_count;
  end if;

  if not exists (
    select 1 from public.translation_entries
     where translation_key = 'insight.' || v_insight_id::text || '.title.en'
  ) then
    raise exception 'VALIDATION FAIL: the deterministic title key was not created';
  end if;

  if exists (
    select 1 from public.translation_entries
     where entity_type = 'insight' and entity_id = v_insight_id
       and field_name not in ('title', 'summary', 'body')
  ) then
    raise exception 'VALIDATION FAIL: an unexpected field was indexed for an insight';
  end if;

  raise notice 'PASS  an article indexes exactly its three translatable fields';

  -- ---------------------------------------------------------------------------
  -- 2. A durable sync job was queued for each entry.
  -- ---------------------------------------------------------------------------
  select count(*) into v_job_count
    from public.translation_sync_jobs j
    join public.translation_entries e on e.id = j.translation_entry_id
   where e.entity_type = 'insight' and e.entity_id = v_insight_id
     and j.status = 'queued';

  if v_job_count <> 3 then
    raise exception
      'VALIDATION FAIL: expected 3 queued sync jobs for the article, found %',
      v_job_count;
  end if;

  raise notice 'PASS  publishing an article queues translation sync work';

  -- ---------------------------------------------------------------------------
  -- 3. The English source is stored, and a pending French row exists.
  --
  -- This is what the read path needs: the English is the fallback, and the French
  -- row is the slot a translation lands in.
  -- ---------------------------------------------------------------------------
  select value, state into v_en_value, v_en_state
    from public.content_translations
   where entity_type = 'insight' and entity_id = v_insight_id
     and field_name = 'title' and locale = 'en';

  if v_en_value is null or v_en_state <> 'translated' then
    raise exception 'VALIDATION FAIL: the English source title was not stored as translated';
  end if;

  select value, state into v_fr_value, v_fr_state
    from public.content_translations
   where entity_type = 'insight' and entity_id = v_insight_id
     and field_name = 'title' and locale = 'fr';

  if v_fr_state <> 'pending' then
    raise exception 'VALIDATION FAIL: the French title row was not created as pending, got %', v_fr_state;
  end if;

  if v_fr_value <> '' then
    raise exception 'VALIDATION FAIL: the French row must start empty, found %', v_fr_value;
  end if;

  raise notice 'PASS  the source value is stored and a pending French row exists';

  -- ---------------------------------------------------------------------------
  -- 4. Re-saving the article is idempotent: no duplicate entries or jobs.
  -- ---------------------------------------------------------------------------
  update public.insights set title = title where id = v_insight_id;

  select count(*) into v_entry_count
    from public.translation_entries
   where entity_type = 'insight' and entity_id = v_insight_id;
  if v_entry_count <> 3 then
    raise exception
      'VALIDATION FAIL: re-saving produced % entries instead of 3', v_entry_count;
  end if;

  select count(*) into v_job_count
    from public.translation_sync_jobs j
    join public.translation_entries e on e.id = j.translation_entry_id
   where e.entity_type = 'insight' and e.entity_id = v_insight_id
     and j.status = 'queued';
  if v_job_count <> 3 then
    raise exception
      'VALIDATION FAIL: re-saving stacked redundant jobs (% queued)', v_job_count;
  end if;

  raise notice 'PASS  re-saving an article does not duplicate entries or jobs';

  -- ---------------------------------------------------------------------------
  -- 5. A real French translation survives an English edit, and is marked
  --    outdated rather than overwritten.
  --
  -- This is the rule that protects a translator's work. `source_updated_at` is
  -- backdated deliberately: `now()` is transaction-constant, so a translation
  -- written and a source edited inside this one transaction would carry identical
  -- timestamps and the "source moved on" branch would never be reached. Backdating
  -- models the real sequence — translation written earlier, source edited now.
  -- ---------------------------------------------------------------------------
  update public.content_translations
     set value = 'Entretien solaire dans le Sud-Ouest',
         state = 'translated',
         translated_at = now(),
         source_updated_at = now() - interval '1 hour'
   where entity_type = 'insight' and entity_id = v_insight_id
     and field_name = 'title' and locale = 'fr';

  update public.insights
     set title = 'Solar maintenance in the Southwest Region'
   where id = v_insight_id;

  select value, state into v_fr_value, v_fr_state
    from public.content_translations
   where entity_type = 'insight' and entity_id = v_insight_id
     and field_name = 'title' and locale = 'fr';

  if v_fr_state <> 'outdated' then
    raise exception
      'VALIDATION FAIL: an edited source should mark the French outdated, got %',
      v_fr_state;
  end if;

  if v_fr_value <> 'Entretien solaire dans le Sud-Ouest' then
    raise exception
      'VALIDATION FAIL: the existing French translation was overwritten (now %)',
      v_fr_value;
  end if;

  raise notice 'PASS  an English edit marks French outdated without destroying it';

  -- ---------------------------------------------------------------------------
  -- 6. A whitespace-only field produces no index entry.
  --
  -- A field with no real source value is not translatable content, so an index row
  -- claiming it exists would be a lie the sync worker then pushes to Tolgee.
  --
  -- Whitespace is used rather than an empty string because the table constraints
  -- require `char_length(summary) >= 1`, so `''` is rejected by the schema before
  -- the trigger runs. `'   '` satisfies the length check but is empty after
  -- `btrim`, which is exactly the case the trigger's guard exists for.
  --
  -- The trigger skips such a field rather than deleting an existing entry, matching
  -- the product and listing implementations: deleting would risk destroying a
  -- translation, which the brief forbids.
  -- ---------------------------------------------------------------------------
  insert into public.insights (
    slug, title, summary, body, publish_state, published_at, author_id
  )
  select
    'validation-insight-blank-summary',
    'An article with a blank summary',
    '   ',
    'The body is present but the summary is only whitespace.',
    'published',
    now(),
    a.id
  from public.authors a
  where a.slug = 'validation-author'
  on conflict (slug) do nothing;

  select id into v_empty_id
    from public.insights
   where slug = 'validation-insight-blank-summary';

  select count(*) into v_empty_count
    from public.translation_entries
   where entity_type = 'insight' and entity_id = v_empty_id;

  if v_empty_count <> 2 then
    raise exception
      'VALIDATION FAIL: a blank summary should yield 2 entries (title, body), found %',
      v_empty_count;
  end if;

  if exists (
    select 1 from public.translation_entries
     where entity_type = 'insight' and entity_id = v_empty_id
       and field_name = 'summary'
  ) then
    raise exception 'VALIDATION FAIL: a blank summary still produced an index entry';
  end if;

  raise notice 'PASS  a blank field produces no translation index entry';
end
$$;

-- -----------------------------------------------------------------------------
-- 7. The function EXECUTE surface.
--
-- These are `SECURITY DEFINER` helpers reachable by a browser key unless revoked.
-- `30_function_execute_hardening.sql` asserts the same property globally; this
-- pins it locally so a future edit to the revoke block fails here too.
-- -----------------------------------------------------------------------------
do $$
declare
  v_role text;
begin
  for v_role in select unnest(array['anon', 'authenticated'])
  loop
    if has_function_privilege(v_role, 'public.sync_insight_translation_index()', 'EXECUTE') then
      raise exception 'VALIDATION FAIL: % may execute sync_insight_translation_index()', v_role;
    end if;
    if has_function_privilege(v_role, 'public.insight_translatable_fields()', 'EXECUTE') then
      raise exception 'VALIDATION FAIL: % may execute insight_translatable_fields()', v_role;
    end if;
  end loop;

  if not has_function_privilege('service_role', 'public.sync_insight_translation_index()', 'EXECUTE') then
    raise exception 'VALIDATION FAIL: service_role lost the sync function grant';
  end if;

  raise notice 'PASS  the insight translation helpers are service-role only';
end
$$;
