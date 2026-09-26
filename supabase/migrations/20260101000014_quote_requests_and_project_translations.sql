-- =============================================================================
-- Phase 5 — Quote-request fields on the inquiry inbox, and project translation
-- index wiring.
--
-- Two concerns:
--
--   1. A quote request carries more than a contact form does: the site's region
--      and locality, the property type, the preferred contact method, and the
--      details to use. Rather than create a parallel `quote_requests` table — which
--      would split the inbox the brief explicitly wants centralised — these are
--      added to `inquiries` as nullable columns. A general contact inquiry leaves
--      them null, and the CRM sees one inbox with richer rows rather than two
--      inboxes that have to be reconciled.
--
--   2. Project and project-media translation entries are created by triggers, on
--      the same pattern as products: an entity written by ANY path (a migration, a
--      script, a future integration) gets its translation index and sync jobs
--      without the application having to remember. The alternative — assembling
--      the index in application code — leaves any entity written by another path
--      silently untranslated.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Preferred contact method. An enum so the CRM cannot accumulate free-text
-- variants of "phone", and so the form's options and the stored value cannot
-- drift apart.
-- -----------------------------------------------------------------------------
create type public.contact_method as enum ('email', 'phone', 'whatsapp');

-- -----------------------------------------------------------------------------
-- Quote-request detail on the inquiry inbox.
--
-- All nullable: a general corporate inquiry has none of these, and forcing a
-- value would corrupt reporting on the corporate contact route. Each is a real
-- FK or constrained value rather than free text where the set is known, so the
-- CRM can filter on it.
-- -----------------------------------------------------------------------------
alter table public.inquiries
  add column property_type public.property_type,
  add column region_id uuid references public.regions (id) on delete set null,
  add column locality text,
  add column contact_method public.contact_method,
  -- The address or number to reply to when it differs from `email`/`phone`.
  -- Free text because it is whatever the visitor typed, and it is displayed
  -- escaped rather than parsed.
  add column preferred_contact text;

comment on column public.inquiries.property_type is
  'Property type for a quote request: residential, commercial or industrial. Null for a general inquiry.';
comment on column public.inquiries.region_id is
  'Region of the site for a quote request. A real FK so the CRM filters on one spelling per region.';
comment on column public.inquiries.locality is
  'Town, area or landmark for the site. Never a precise coordinate.';
comment on column public.inquiries.contact_method is
  'How the visitor asked to be contacted. Null when not stated.';
comment on column public.inquiries.preferred_contact is
  'Address or number to reply to when it differs from the inquiry email/phone.';

alter table public.inquiries
  add constraint inquiries_locality_length check (
    locality is null or char_length(locality) between 1 and 160
  ),
  add constraint inquiries_preferred_contact_length check (
    preferred_contact is null or char_length(preferred_contact) between 1 and 254
  );

create index inquiries_region_idx
  on public.inquiries (region_id, created_at desc)
  where region_id is not null;

create index inquiries_property_type_idx
  on public.inquiries (property_type, created_at desc)
  where property_type is not null;

-- -----------------------------------------------------------------------------
-- Project translation index.
--
-- Mirrors `sync_product_translation_index`: inserting or updating a project's
-- translatable fields creates one index entry per field, so the entity is
-- translatable no matter who wrote it. A field removed from the source marks its
-- entry for re-sync rather than deleting the translation, matching the rule that
-- a source change never destroys an existing translation.
-- -----------------------------------------------------------------------------
create or replace function public.sync_electrical_project_translation_index()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  field text;
  fields text[] := array['title', 'summary', 'description', 'scope', 'outcome'];
  current_value text;
begin
  foreach field in array fields
  loop
    execute format('select ($1).%I::text', field) into current_value using new;

    if current_value is null or btrim(current_value) = '' then
      -- The source field has no content, so there is nothing to translate. Mark
      -- any existing entry as outdated rather than deleting it: a translation
      -- that already exists must not be destroyed by clearing the source.
      update public.translation_entries
        set state = 'outdated', sync_state = 'queued'
        where entity_type = 'electrical_project'
          and entity_id = new.id
          and field_name = field;
      continue;
    end if;

    insert into public.translation_entries (
      translation_key, entity_type, entity_id, field_name,
      source_locale, target_locales, state, sync_state
    )
    values (
      public.build_translation_key('electrical_project', new.id, field, 'en'),
      'electrical_project',
      new.id,
      field,
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
          -- A source edit invalidates a completed translation, but the
          -- translation text itself is preserved.
          state = case
            when public.translation_entries.state in ('translated', 'reviewed')
              then 'outdated'::public.translation_state
            else public.translation_entries.state
          end;
  end loop;

  return new;
end;
$$;

comment on function public.sync_electrical_project_translation_index() is
  'Creates/updates translation index entries for an electrical project. Preserves existing translations when the source changes.';

create trigger electrical_projects_sync_translation_index
  after insert or update of
    title, summary, description, scope, outcome
  on public.electrical_projects
  for each row execute function public.sync_electrical_project_translation_index();

-- -----------------------------------------------------------------------------
-- Project media alt text is translatable, so it gets the same index treatment.
-- Keyed on the media row, which is why `project_media` is added as an entity type.
-- -----------------------------------------------------------------------------
alter type public.translatable_entity_type add value if not exists 'project_media';

create or replace function public.sync_project_media_translation_index()
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
    public.build_translation_key('project_media', new.id, 'alt_text', 'en'),
    'project_media',
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

create trigger project_media_sync_translation_index
  after insert or update of alt_text
  on public.project_media
  for each row execute function public.sync_project_media_translation_index();
