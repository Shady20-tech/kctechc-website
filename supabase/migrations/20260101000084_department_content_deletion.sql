-- =============================================================================
-- Department-scoped permanent deletion for authored content.
--
-- A department editor could create and edit a product, project or article but
-- could not remove one: `delete_content_permanently` was super-admin only and
-- `forbid_unsanctioned_delete` refused every other caller. That left a draft
-- created by mistake with no removal path except asking a super admin.
--
-- This migration keeps the super-admin override and adds a department-scoped
-- path for the three authored content types:
--
--   * a super admin may delete any product, project or article;
--   * a department editor may delete a product, project or article belonging to
--     a department they may author (`is_department_editor`);
--   * property listings keep their own retention-gated path and are unchanged.
--
-- The raw-DELETE trigger stays closed to department editors. The RPC sets a
-- transaction-local `kc.content_deletion` marker before its own delete, so a
-- direct PostgREST DELETE cannot use the department-editor branch and bypass the
-- translation/SEO cleanup the RPC performs.
-- =============================================================================

create or replace function public.forbid_unsanctioned_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_slug text;
begin
  -- Trusted contexts (migrations, service role, the validation harness) and a
  -- super admin may delete directly, as before.
  if auth.uid() is null or public.is_super_admin() then
    return old;
  end if;

  -- The permanent-deletion RPC marks its transaction. Only then may a department
  -- editor pass this trigger, and only for a row in a department they author.
  if current_setting('kc.content_deletion', true) = 'on' then
    if tg_table_name = 'products' then
      select d.slug
      into v_department_slug
      from public.product_categories c
      join public.departments d on d.id = c.department_id
      where c.id = (to_jsonb(old) ->> 'category_id')::uuid;
    elsif tg_table_name = 'electrical_projects' then
      select d.slug
      into v_department_slug
      from public.departments d
      where d.id = (to_jsonb(old) ->> 'department_id')::uuid;
    elsif tg_table_name = 'insights' then
      select d.slug
      into v_department_slug
      from public.departments d
      where d.id = (to_jsonb(old) ->> 'department_id')::uuid;
    end if;

    if v_department_slug is not null
      and public.is_department_editor(v_department_slug) then
      return old;
    end if;
  end if;

  raise exception
    'Deleting a % is restricted to a super administrator or the owning department editor; archive it instead',
    tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

comment on function public.forbid_unsanctioned_delete is
  'Refuses a hard delete of a content row unless the caller is a super admin, a trusted context, or the permanent-deletion RPC acting for the owning department editor.';

create or replace function public.delete_content_permanently(
  p_entity_type text,
  p_entity_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_table text;
  v_department_slug text;
begin
  if not public.is_super_admin() then
    if p_entity_type = 'product' then
      select d.slug
      into v_department_slug
      from public.products p
      join public.product_categories c on c.id = p.category_id
      join public.departments d on d.id = c.department_id
      where p.id = p_entity_id;
    elsif p_entity_type = 'electrical_project' then
      select d.slug
      into v_department_slug
      from public.electrical_projects p
      join public.departments d on d.id = p.department_id
      where p.id = p_entity_id;
    elsif p_entity_type = 'insight' then
      select d.slug
      into v_department_slug
      from public.insights i
      join public.departments d on d.id = i.department_id
      where i.id = p_entity_id;
    end if;

    if v_department_slug is null
      or not public.is_department_editor(v_department_slug) then
      raise exception
        'Only a super administrator or the owning department editor may permanently delete this content'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'Permanent deletion requires a reason of at least 10 characters'
      using errcode = 'check_violation';
  end if;

  -- Whitelist, so the table name can never come from the caller unvalidated.
  v_table := case p_entity_type
    when 'product' then 'products'
    when 'electrical_project' then 'electrical_projects'
    when 'insight' then 'insights'
    else null
  end;

  if v_table is null then
    raise exception 'Unsupported content type for permanent deletion: %', p_entity_type
      using errcode = 'check_violation';
  end if;

  -- The translation index, localized values and SEO overrides carry no foreign
  -- key to the entity, so they do not cascade and must be cleared explicitly or
  -- they would outlive the row and keep its keys in the Tolgee queue.
  delete from public.translation_entries
  where entity_type = p_entity_type::public.translatable_entity_type
    and entity_id = p_entity_id;
  delete from public.content_translations
  where entity_type = p_entity_type::public.translatable_entity_type
    and entity_id = p_entity_id;
  delete from public.entity_seo
  where entity_type = p_entity_type::public.translatable_entity_type
    and entity_id = p_entity_id;

  -- The BEFORE DELETE trigger reads this marker to admit a department editor.
  perform set_config('kc.content_deletion', 'on', true);
  perform set_config('kc.audit_reason', btrim(p_reason), true);

  execute format('delete from public.%I where id = $1', v_table) using p_entity_id;

  if not found then
    raise exception 'Unknown % with id %', p_entity_type, p_entity_id
      using errcode = 'no_data_found';
  end if;
end;
$$;

comment on function public.delete_content_permanently is
  'Permanently deletes a product, electrical project or insight. A super admin may delete any; a department editor may delete content in a department they author. Requires a substantive reason.';

-- The signatures are unchanged, so the existing EXECUTE grants still name the
-- same functions. This assertion makes that explicit and fails the migration if a
-- later edit reintroduces the super-admin-only guard.
do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef(
    'public.delete_content_permanently(text, uuid, text)'::regprocedure
  );

  if position('is_department_editor' in v_def) = 0 then
    raise exception
      'VALIDATION FAIL: delete_content_permanently has no department-editor path';
  end if;

  v_def := pg_get_functiondef(
    'public.forbid_unsanctioned_delete()'::regprocedure
  );

  if position('kc.content_deletion' in v_def) = 0 then
    raise exception
      'VALIDATION FAIL: the delete trigger does not require the RPC marker';
  end if;

  raise notice 'PASS  permanent deletion is scoped to the owning department editor';
end;
$$;
