-- =============================================================================
-- Post authoring: images on articles, and department-scoped authoring.
--
-- Two gaps are closed here.
--
-- 1. An article could carry exactly one image — its cover. There was nowhere to
--    attach the additional photographs a post actually needs, and the body
--    renderer had no image syntax at all. `insight_media` is the gallery table
--    the editor needs, mirroring `project_media` on the completed-work surface,
--    and `insight_media` joins `translatable_entity_type` so its alt text is
--    indexed for translation the same way a project image's is.
--
-- 2. Only `ELEVATED_ROLES` could author articles, so a department could not post
--    about its own work. The write policies were `is_admin()`, which is true for
--    every admin-capable role and therefore too broad *and* too narrow at once:
--    a Digital Marketing admin could edit an Electrical Services post, while the
--    staff who did the work could not write anything. The policies below replace
--    that with the department boundary already used by completed work
--    (`is_department_editor`), so a department's staff and admins author their
--    own posts and nobody else's.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Article media.
--
-- Shape and constraints mirror `project_media`: a storage-relative object path
-- (no scheme, no leading slash, no traversal), a required alt text, and optional
-- caption/credit. Alt text is translatable, so a French reader gets a French
-- description rather than an English one read aloud by a screen reader.
-- -----------------------------------------------------------------------------
create table public.insight_media (
  id uuid primary key default extensions.gen_random_uuid(),
  insight_id uuid not null references public.insights (id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  caption text,
  credit text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint insight_media_path_format check (
    storage_path ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$'
    and storage_path !~ '\.\.'
    and storage_path !~ '^/'
  ),
  constraint insight_media_alt_length check (
    char_length(alt_text) between 1 and 300
  ),
  constraint insight_media_caption_length check (
    caption is null or char_length(caption) between 1 and 400
  ),
  constraint insight_media_credit_length check (
    credit is null or char_length(credit) between 1 and 200
  ),
  constraint insight_media_position_non_negative check (position >= 0)
);

comment on table public.insight_media is
  'Photographs attached to an article. The cover stays on `insights.cover_image_path`; this table holds the gallery.';

create index insight_media_insight_idx
  on public.insight_media (insight_id, position);

create trigger insight_media_set_updated_at
  before update on public.insight_media
  for each row execute function public.set_updated_at();

alter table public.insight_media enable row level security;

-- A gallery image is as public as the article it belongs to: the read policy
-- defers to the article's own visibility rather than duplicating the rule.
create policy "insight_media_select_published"
  on public.insight_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.insights i
      where i.id = insight_id
        and i.publish_state = 'published'
    )
  );

-- An editor may manage media for an article they may author. The check is the
-- article's department, expressed with the same predicate the article policy
-- uses, so the two cannot drift apart.
create policy "insight_media_write_department"
  on public.insight_media for all
  to authenticated
  using (
    exists (
      select 1
      from public.insights i
      left join public.departments d on d.id = i.department_id
      where i.id = insight_id
        and (
          case
            when i.department_id is null then
              public.current_user_role() in ('super_admin', 'department_staff')
            else public.is_department_editor(d.slug)
          end
        )
    )
  )
  with check (
    exists (
      select 1
      from public.insights i
      left join public.departments d on d.id = i.department_id
      where i.id = insight_id
        and (
          case
            when i.department_id is null then
              public.current_user_role() in ('super_admin', 'department_staff')
            else public.is_department_editor(d.slug)
          end
        )
    )
  );

-- -----------------------------------------------------------------------------
-- Alt text is translatable, exactly as a project image's is.
--
-- The value is added to the enum here and *used* only from inside the trigger
-- function below, which the database evaluates at insert time rather than at
-- migration time — so the "cannot use a new enum value in the same transaction
-- that adds it" rule is not violated.
-- -----------------------------------------------------------------------------
alter type public.translatable_entity_type add value if not exists 'insight_media';

create or replace function public.sync_insight_media_translation_index()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.translation_entries (
    translation_key, entity_type, entity_id, field_name,
    source_locale, target_locales, state, sync_state
  )
  values (
    public.build_translation_key('insight_media', new.id, 'alt_text', 'en'),
    'insight_media',
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
        end;

  return new;
end;
$$;

create trigger insight_media_sync_translation_index
  after insert or update of alt_text
  on public.insight_media
  for each row execute function public.sync_insight_media_translation_index();

-- Supabase grants EXECUTE on a new function to `anon`/`authenticated` by default
-- (see the Phase 12 gotcha). A trigger function is not directly callable, but the
-- grant is still surface, and the hardening migration that revoked the rest ran
-- before this one created this function — so the revoke is repeated here rather
-- than assumed. `service_role` keeps it because a maintenance path may invoke it.
revoke all on function public.sync_insight_media_translation_index() from public;
revoke all on function public.sync_insight_media_translation_index() from anon, authenticated;
grant execute on function public.sync_insight_media_translation_index() to service_role;

-- -----------------------------------------------------------------------------
-- Department-scoped article authoring.
--
-- The rule, in one place, is: an article's department must be one the caller may
-- author. A cross-department role (`super_admin`, `department_staff`) may also
-- leave an article's department unset, because a corporate announcement belongs
-- to no single department; a department editor may not, because an unset
-- department is not one they can be shown to own.
--
-- `is_department_editor` is reused rather than re-derived, so this boundary is
-- the same object the completed-work policies use and `roles.test.ts` already
-- asserts against `DEPARTMENT_EDITOR_ROLES`.
-- -----------------------------------------------------------------------------
drop policy if exists "insights_write_admin" on public.insights;
create policy "insights_write_department"
  on public.insights for all
  to authenticated
  using (
    case
      when department_id is null then
        public.current_user_role() in ('super_admin', 'department_staff')
      else exists (
        select 1 from public.departments d
        where d.id = department_id
          and public.is_department_editor(d.slug)
      )
    end
  )
  with check (
    case
      when department_id is null then
        public.current_user_role() in ('super_admin', 'department_staff')
      else exists (
        select 1 from public.departments d
        where d.id = department_id
          and public.is_department_editor(d.slug)
      )
    end
  );

-- An editor sees their own department's drafts, not every draft. The previous
-- policy was `is_admin()`, which let a Digital Marketing admin read an Electrical
-- Services article before it was published.
drop policy if exists "insights_select_admin" on public.insights;
create policy "insights_select_department"
  on public.insights for select
  to authenticated
  using (
    case
      when department_id is null then
        public.current_user_role() in ('super_admin', 'department_staff')
      else exists (
        select 1 from public.departments d
        where d.id = department_id
          and public.is_department_editor(d.slug)
      )
    end
  );
