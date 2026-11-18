-- =============================================================================
-- Phase 7 — Permanent deletion of the remaining content types.
--
-- Migration 67 closed the hard-delete hole and gave listings a reasoned,
-- retention-gated removal path. This migration completes "full admin CRUD" for
-- the other three authorable content types — a product, an electrical project and
-- an insight article — which had create, edit and publish but no way to remove a
-- mistake.
--
-- ## Why one function and not three
--
-- The three differ only in their table and their `translatable_entity_type`. The
-- retention question does not arise: their children (`product_media`,
-- `project_media`, `insight_media`, localized slugs, service links) all cascade,
-- and an order line keeps its own snapshot of title, sku, slug and price, so a
-- deleted product does not rewrite a past order — it only nulls the `product_id`
-- link. So a single super-admin-gated function with a whitelist of the three
-- tables is enough, and it is deliberately a whitelist rather than "any table
-- name": a caller-supplied table name would be an injection surface, and
-- `property_listings` is excluded because it has its own retention gate.
--
-- ## It cannot be a browser DELETE
--
-- `forbid_unsanctioned_delete` (migration 67) already refuses a raw DELETE of
-- these rows to anyone but a super admin, and the `for all` write policies still
-- grant DELETE. This function is the supported path: it clears the FK-less
-- translation rows explicitly, then deletes the row. The audit trigger for the
-- deletion lives here rather than in 67 because the four tables want different
-- entity types on their audit row.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Record a permanent deletion, per content type.
--
-- One trigger function for all three tables; `tg_table_name` selects the entity
-- type, so the audit row says which kind of record went. The reason travels on
-- the same transaction-local GUC the listing path uses.
-- -----------------------------------------------------------------------------
create or replace function public.audit_content_deletion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity_type text;
  v_label text;
begin
  v_entity_type := case tg_table_name
    when 'products' then 'product'
    when 'electrical_projects' then 'electrical_project'
    when 'insights' then 'insight'
    else tg_table_name
  end;

  -- A human label for the log table, read from whichever column the row has.
  v_label := case tg_table_name
    when 'products' then old.title
    when 'electrical_projects' then old.title
    when 'insights' then old.title
    else old.id::text
  end;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata, reason
  )
  values (
    auth.uid(),
    'content_deleted',
    v_entity_type,
    old.id::text,
    jsonb_build_object('label', v_label, 'table', tg_table_name),
    public.audit_reason()
  );

  return old;
end;
$$;

comment on function public.audit_content_deletion is
  'Records a permanent product/project/insight deletion in the audit trail.';

drop trigger if exists products_audit_delete on public.products;
create trigger products_audit_delete
  after delete on public.products
  for each row execute function public.audit_content_deletion();

drop trigger if exists electrical_projects_audit_delete on public.electrical_projects;
create trigger electrical_projects_audit_delete
  after delete on public.electrical_projects
  for each row execute function public.audit_content_deletion();

drop trigger if exists insights_audit_delete on public.insights;
create trigger insights_audit_delete
  after delete on public.insights
  for each row execute function public.audit_content_deletion();

-- -----------------------------------------------------------------------------
-- 2. The deletion function.
-- -----------------------------------------------------------------------------
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
begin
  if not public.is_super_admin() then
    raise exception 'Only a super administrator may permanently delete content'
      using errcode = 'insufficient_privilege';
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

  perform set_config('kc.audit_reason', btrim(p_reason), true);

  execute format('delete from public.%I where id = $1', v_table) using p_entity_id;

  if not found then
    raise exception 'Unknown % with id %', p_entity_type, p_entity_id
      using errcode = 'no_data_found';
  end if;
end;
$$;

comment on function public.delete_content_permanently is
  'Permanently deletes a product, electrical project or insight. Super-admin only, requires a substantive reason.';

-- -----------------------------------------------------------------------------
-- 3. Classify the new functions for the EXECUTE surface.
--
-- Supabase grants EXECUTE on a new function to anon/authenticated by default, and
-- the Phase 12 hardening migration ran before these existed, so the classification
-- is repeated here. `delete_content_permanently` is called through the session
-- client so `auth.uid()` attributes the actor; its internal `is_super_admin()`
-- guard is the control. The trigger function is not browser-callable.
-- -----------------------------------------------------------------------------
revoke all on function public.delete_content_permanently(text, uuid, text) from public, anon, authenticated;
revoke all on function public.audit_content_deletion() from public, anon, authenticated;

grant execute on function public.delete_content_permanently(text, uuid, text) to authenticated, service_role;
grant execute on function public.audit_content_deletion() to service_role;

-- -----------------------------------------------------------------------------
-- 4. Self-check the deletion audit triggers are installed.
-- -----------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(expected.tbl, ', ')
  into v_missing
  from (
    values ('products'), ('electrical_projects'), ('insights')
  ) as expected(tbl)
  where not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = expected.tbl
      and t.tgname = expected.tbl || '_audit_delete'
      and not t.tgisinternal
  );

  if v_missing is not null then
    raise exception 'VALIDATION FAIL: content deletion audit trigger missing on %', v_missing;
  end if;

  raise notice 'PASS  content deletion audit triggers are installed';
end
$$;
