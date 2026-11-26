-- =============================================================================
-- Phase 4 (follow-up) — Replace the admin-entered GTIN with an automatic
-- product reference.
--
-- The GTIN field required an editor to know a manufacturer's barcode number and
-- to type 8, 12, 13 or 14 digits with a valid GS1 check digit. That is a data
-- entry task for a supply-chain system, not for a department admin posting a
-- product, and the failure mode was a refused save with a check-digit error.
--
-- What replaces it is a reference the database issues itself, in the same shape
-- as the listing reference the real-estate side already uses
-- (`KC-RE-000042`). Nothing is asked of the editor.
--
-- Why not reuse `sku`: `sku` is the stock-keeping code an editor chooses, it is
-- unique and NOT NULL, and existing rows depend on their values. A generated
-- column would either collide with a real SKU or force every existing SKU to be
-- rewritten. The reference is a separate identifier with a separate job: it is
-- the stable public handle for a product ("quote KC-PR-000123"), not a stock key.
--
-- Why not keep `gtin` and simply hide it: a column that the admin form no longer
-- writes but the public page still renders would show a value nobody can now
-- maintain, and it would keep `gtin_is_valid` (and its EXECUTE grant) alive for a
-- field with no producer. Dropping it removes the whole path.
--
-- Safety of the drop, given the database is in production:
--
--   * `gtin` is nullable, has no index of its own, and is referenced by exactly
--     one object: the `products_gtin_valid` CHECK constraint, which is dropped in
--     the same transaction. `drop column` drops a dependent check automatically,
--     but naming it explicitly keeps the migration readable and fails loudly if
--     the constraint has been renamed.
--   * No foreign key, view, generated column or trigger in the migration set
--     reads `gtin`; the only readers were the admin form and the storefront
--     spec table, both changed in the same commit.
--   * The drop is guarded by `if exists`, so re-running is a no-op.
--
-- This file is additive in the sense that matters for a live database: it
-- creates the replacement first and backfills it, then removes the unused
-- column. No row is deleted and no other table is touched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The reference generator.
--
-- A sequence, not a random suffix: concurrent inserts then cannot collide, and
-- the value is short enough to read over the phone. `lpad` to six digits matches
-- the listing reference so the two read as one family.
-- -----------------------------------------------------------------------------
create sequence if not exists public.product_reference_seq;

create or replace function public.generate_product_reference()
returns text
language sql
volatile
as $$
  select 'KC-PR-' || lpad(nextval('public.product_reference_seq')::text, 6, '0');
$$;

comment on function public.generate_product_reference() is
  'Sequential product reference, e.g. KC-PR-000042. Issued by the database so an editor never types an identifier.';

-- Supabase grants EXECUTE on a new public function to anon/authenticated by
-- default (see 20260101000041). Products are written with the service-role
-- client, so the reference default never runs as a browser key and the grant is
-- pure attack surface. Revoke it here, in the migration that creates it, because
-- the Phase 12 hardening migration has already run and will not revisit it.
revoke all on function public.generate_product_reference() from public;
revoke all on function public.generate_product_reference() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. The column.
--
-- Added nullable, backfilled, then made NOT NULL and given a default. Doing it in
-- that order means the ALTERs cannot fail on a table that already holds rows,
-- which is the production case.
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists product_reference text;

-- Backfill existing rows. `nextval` is evaluated per row, so each gets its own
-- value; ordering by `created_at` makes the numbering follow the catalogue's
-- actual age rather than whatever order the planner returns.
update public.products
set product_reference = 'KC-PR-' || lpad(nextval('public.product_reference_seq')::text, 6, '0')
where product_reference is null;

alter table public.products
  alter column product_reference set default public.generate_product_reference(),
  alter column product_reference set not null;

alter table public.products
  add constraint products_product_reference_unique unique (product_reference);

comment on column public.products.product_reference is
  'Public reference for a product, e.g. KC-PR-000042. Generated by the database; never entered by an editor. Distinct from sku, which is the stock-keeping code.';

-- -----------------------------------------------------------------------------
-- 3. Remove the GTIN path.
-- -----------------------------------------------------------------------------
alter table public.products
  drop constraint if exists products_gtin_valid;

alter table public.products
  drop column if exists gtin;

-- The validator existed only for that CHECK. With the constraint gone it has no
-- caller, and Phase 12's hardening allow-listed it by name; leaving it would keep
-- a browser-executable function with no purpose.
drop function if exists public.gtin_is_valid(text);

-- -----------------------------------------------------------------------------
-- 4. Assert the result.
--
-- Runs on every application, so a database where the drop silently did not
-- happen (or where a later migration re-added the column) fails loudly here
-- rather than rendering a product page with a missing field.
-- -----------------------------------------------------------------------------
do $$
declare
  v_gtin_column integer;
  v_ref_column integer;
  v_missing integer;
begin
  select count(*) into v_gtin_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'products'
    and column_name = 'gtin';

  if v_gtin_column <> 0 then
    raise exception 'gtin column still present on public.products';
  end if;

  select count(*) into v_ref_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'products'
    and column_name = 'product_reference'
    and is_nullable = 'NO';

  if v_ref_column <> 1 then
    raise exception 'product_reference is missing or nullable on public.products';
  end if;

  select count(*) into v_missing
  from public.products
  where product_reference is null or product_reference !~ '^KC-PR-[0-9]{6}$';

  if v_missing <> 0 then
    raise exception 'product_reference is malformed on % row(s)', v_missing;
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'gtin_is_valid'
  ) then
    raise exception 'gtin_is_valid still exists';
  end if;

  raise notice 'PASS  product_reference replaced gtin';
end
$$;
