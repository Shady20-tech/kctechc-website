-- =============================================================================
-- Department-scoped store: products and categories belong to a department.
--
-- `product_categories.department_id` has always existed, and a product's
-- department is therefore already implied by its category. What was missing was
-- the boundary: every write policy on the store tables was `is_admin()`, which is
-- true for every admin-capable role. A Digital Marketing admin could create an
-- Electrical Services product and vice versa, and the console only ever offered
-- Digital Marketing categories — so in practice a super admin could not place a
-- product in another department at all, and the department that owns the product
-- had no way to manage it.
--
-- This migration replaces those policies with the department predicate already
-- used by completed-work authoring (`is_department_editor`). The department of a
-- product is reached by joining `products -> product_categories -> departments`,
-- so the rule is stated once and holds for every child table.
--
-- The read policies are untouched: a published product in a published category
-- stays world-readable, which is what lets it appear on its department's public
-- surface.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categories.
--
-- A category's department is a column on the row, so the check is direct.
-- -----------------------------------------------------------------------------
drop policy if exists "product_categories_write_admin" on public.product_categories;
create policy "product_categories_write_department"
  on public.product_categories for all
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_id
        and public.is_department_editor(d.slug)
    )
  )
  with check (
    exists (
      select 1 from public.departments d
      where d.id = department_id
        and public.is_department_editor(d.slug)
    )
  );

drop policy if exists "product_category_slugs_write_admin" on public.product_category_slugs;
create policy "product_category_slugs_write_department"
  on public.product_category_slugs for all
  to authenticated
  using (
    exists (
      select 1
      from public.product_categories c
      join public.departments d on d.id = c.department_id
      where c.id = category_id
        and public.is_department_editor(d.slug)
    )
  )
  with check (
    exists (
      select 1
      from public.product_categories c
      join public.departments d on d.id = c.department_id
      where c.id = category_id
        and public.is_department_editor(d.slug)
    )
  );

-- -----------------------------------------------------------------------------
-- Products and their children.
--
-- A product carries no department of its own; the department is its category's.
-- Every policy below therefore joins through the category, which is the single
-- place the department is recorded.
-- -----------------------------------------------------------------------------
drop policy if exists "products_write_admin" on public.products;
create policy "products_write_department"
  on public.products for all
  to authenticated
  using (
    exists (
      select 1
      from public.product_categories c
      join public.departments d on d.id = c.department_id
      where c.id = category_id
        and public.is_department_editor(d.slug)
    )
  )
  with check (
    exists (
      select 1
      from public.product_categories c
      join public.departments d on d.id = c.department_id
      where c.id = category_id
        and public.is_department_editor(d.slug)
    )
  );

drop policy if exists "product_slugs_write_admin" on public.product_slugs;
create policy "product_slugs_write_department"
  on public.product_slugs for all
  to authenticated
  using (
    exists (
      select 1
      from public.products p
      join public.product_categories c on c.id = p.category_id
      join public.departments d on d.id = c.department_id
      where p.id = product_id
        and public.is_department_editor(d.slug)
    )
  )
  with check (
    exists (
      select 1
      from public.products p
      join public.product_categories c on c.id = p.category_id
      join public.departments d on d.id = c.department_id
      where p.id = product_id
        and public.is_department_editor(d.slug)
    )
  );

drop policy if exists "product_media_write_admin" on public.product_media;
create policy "product_media_write_department"
  on public.product_media for all
  to authenticated
  using (
    exists (
      select 1
      from public.products p
      join public.product_categories c on c.id = p.category_id
      join public.departments d on d.id = c.department_id
      where p.id = product_id
        and public.is_department_editor(d.slug)
    )
  )
  with check (
    exists (
      select 1
      from public.products p
      join public.product_categories c on c.id = p.category_id
      join public.departments d on d.id = c.department_id
      where p.id = product_id
        and public.is_department_editor(d.slug)
    )
  );

-- The stock ledger is internal, but it is still written per product, so it takes
-- the same department boundary rather than the broader `is_admin()`.
drop policy if exists "inventory_movements_write_admin" on public.inventory_movements;
create policy "inventory_movements_write_department"
  on public.inventory_movements for all
  to authenticated
  using (
    exists (
      select 1
      from public.products p
      join public.product_categories c on c.id = p.category_id
      join public.departments d on d.id = c.department_id
      where p.id = product_id
        and public.is_department_editor(d.slug)
    )
  )
  with check (
    exists (
      select 1
      from public.products p
      join public.product_categories c on c.id = p.category_id
      join public.departments d on d.id = c.department_id
      where p.id = product_id
        and public.is_department_editor(d.slug)
    )
  );

-- An editor may read their own department's drafts and unpublished categories in
-- the console. The previous admin read policies used `is_admin()`, which exposed
-- another department's unpublished rows; these are scoped the same way the write
-- policies are, so the console list and the write agree on the boundary.
drop policy if exists "product_categories_select_admin" on public.product_categories;
create policy "product_categories_select_department"
  on public.product_categories for select
  to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_id
        and public.is_department_editor(d.slug)
    )
  );

drop policy if exists "products_select_admin" on public.products;
create policy "products_select_department"
  on public.products for select
  to authenticated
  using (
    exists (
      select 1
      from public.product_categories c
      join public.departments d on d.id = c.department_id
      where c.id = category_id
        and public.is_department_editor(d.slug)
    )
  );
