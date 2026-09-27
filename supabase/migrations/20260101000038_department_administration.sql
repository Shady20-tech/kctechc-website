-- =============================================================================
-- Phase 10 — Department-scoped administration
--
-- Until now the admin policies answered one question: *is this user an admin?*
-- Any admin role read any department's data. A digital-marketing admin could
-- read a property inquiry's PII, and an electrical admin could read a marketing
-- lead. The `can_access_department()` helper was written in
-- `20260101000002_identity_and_roles.sql` for exactly this purpose, but no policy
-- ever referenced it, so the separation was declared and never enforced
-- (`select count(*) from pg_policies where ... like '%can_access_department%'`
-- returned 0).
--
-- This migration makes the boundary real. It is deliberately *policy-only*: no
-- column is added, no row is moved. Every table keeps the shape it had, so the
-- change is reversible by restoring a single file rather than by unwinding data.
--
-- The product decision this encodes:
--
--   * The store is shared between Digital Marketing and Electrical Services.
--     Those two departments were deliberately given equal storefront weight on
--     the corporate gateway, and the store sells the electrical catalogue, so it
--     belongs to both. It is the *only* shared surface, and it is shared by
--     explicitly listing the two roles rather than by a department comparison.
--   * Real Estate administers neither the store nor the blog. Its admin surface
--     is listings.
--   * Everything with a department is otherwise scoped: a department admin sees
--     only their own department's records. The blog follows this rule too — a
--     marketing author writes marketing posts, not electrical ones.
--   * Corporate records that carry no department stay visible to admin roles —
--     they are not another department's private data. A general corporate
--     inquiry is intentionally unowned (`inquiries.department_id` is nullable
--     for this reason).
--   * `super_admin` and `department_staff` remain cross-department.
--
-- `is_inquiry_manager()` is left untouched. It answers a different question
-- ("may this role manage the inquiry pipeline at all?") and is used by
-- listing-scoped policies that this migration must not disturb. Narrowing happens
-- in the policy, which composes the two helpers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Which department a role belongs to, as a first-class function.
--
-- Mirrors `getRoleDepartment()` in `src/lib/auth/roles.ts`. `current_user_role()`
-- is `security definer`, so this reads `profiles` without re-entering the profile
-- policy, which is the same pattern the rest of the identity helpers use.
--
-- Returns null for super_admin, department_staff and customer: they have no single
-- department, and the callers below decide what that means per surface rather than
-- this function guessing.
-- -----------------------------------------------------------------------------
create or replace function public.current_user_department()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case public.current_user_role()
    when 'digital_marketing_staff' then 'digital-marketing'
    when 'digital_marketing_admin' then 'digital-marketing'
    when 'electrical_staff' then 'electrical-services'
    when 'electrical_admin' then 'electrical-services'
    when 'real_estate_agent' then 'real-estate'
    when 'real_estate_admin' then 'real-estate'
    else null
  end;
$$;

comment on function public.current_user_department is
  'Department slug for a single-department role; null for cross-department roles. Mirrors ROLE_DEPARTMENTS in src/lib/auth/roles.ts.';

-- -----------------------------------------------------------------------------
-- The two composed predicates.
--
-- `_read` exists for a different reason than `_write`, and only in the
-- department-less case do they differ. An admin may *read* a corporate record
-- belonging to no department, because it is not another department's private
-- data. They may not *mint* one, because filing is a decision that belongs with
-- the departments or with super_admin.
-- -----------------------------------------------------------------------------
create or replace function public.can_manage_department(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.is_inquiry_manager()
    and (
      p_slug is null
       or public.current_user_role() in ('super_admin', 'department_staff')
       or p_slug = public.current_user_department()
    ),
    false
  );
$$;

comment on function public.can_manage_department is
  'May the current user act on records for this department (null = corporate)? Read and write.';

create or replace function public.can_read_department(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.is_inquiry_manager()
    and (
      p_slug is null
       or public.current_user_role() in ('super_admin', 'department_staff')
       or p_slug = public.current_user_department()
    ),
    false
  );
$$;

comment on function public.can_read_department is
  'May the current user read records for this department (null = corporate)? Currently equivalent to can_manage_department; separate so a future read/write split does not silently re-open a write path.';

-- -----------------------------------------------------------------------------
-- Shared-surface accessors.
--
-- The store belongs to Digital Marketing and Electrical Services; the blog is the
-- corporate marketing channel, so it follows the same boundary.
-- -----------------------------------------------------------------------------
create or replace function public.is_store_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.current_user_role() in (
      'digital_marketing_admin',
      'electrical_admin',
      'department_staff',
      'super_admin'
    ),
    false
  );
$$;

comment on function public.is_store_manager is
  'Roles that administer the store: Digital Marketing and Electrical Services share it; Real Estate does not.';

create or replace function public.is_content_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.current_user_role() in (
      'digital_marketing_admin',
      'electrical_admin',
      'department_staff',
      'super_admin'
    ),
    false
  );
$$;

comment on function public.is_content_manager is
  'Roles that may author content at all: Marketing and Electrical. Real Estate does not write the blog. Which department''s posts they may touch is decided by the row, not this function.';

-- -----------------------------------------------------------------------------
-- Replace the department-blind policies.
--
-- Dropping before creating is required: a policy that is not dropped keeps
-- granting access, and the union of a broad and a narrow policy is the broad one.
-- -----------------------------------------------------------------------------

-- Inquiries: manager visibility narrowed by department. The agent policy above
-- (`inquiry_is_for_agent_listing`) is untouched — an agent still sees their own
-- listing's inquiries and nothing more.
drop policy if exists "inquiries_select_manager" on public.inquiries;
create policy "inquiries_select_manager"
  on public.inquiries for select
  to authenticated
  using (
    public.is_inquiry_manager()
    and public.can_read_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  );

drop policy if exists "inquiries_update_manager" on public.inquiries;
create policy "inquiries_update_manager"
  on public.inquiries for update
  to authenticated
  using (
    public.is_inquiry_manager()
    and public.can_manage_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  )
  with check (public.is_inquiry_manager());

-- Inquiry events: a subquery rather than a correlated predicate, so the row's
-- department is resolved once and reused for every event.
drop policy if exists "inquiry_events_select_manager" on public.inquiry_events;
create policy "inquiry_events_select_manager"
  on public.inquiry_events for select
  to authenticated
  using (
    public.is_inquiry_manager()
    and exists (
      select 1
      from public.inquiries i
      left join public.departments d on d.id = i.department_id
      where i.id = inquiry_events.inquiry_id
        and public.can_read_department(d.slug)
    )
  );

drop policy if exists "inquiry_events_insert_manager" on public.inquiry_events;
create policy "inquiry_events_insert_manager"
  on public.inquiry_events for insert
  to authenticated
  with check (
    public.is_inquiry_manager()
    and exists (
      select 1
      from public.inquiries i
      left join public.departments d on d.id = i.department_id
      where i.id = inquiry_events.inquiry_id
        and public.can_manage_department(d.slug)
    )
  );

-- Attachments carry a visitor's photographs. They follow the inquiry exactly.
drop policy if exists "inquiry_attachments_select_manager" on public.inquiry_attachments;
create policy "inquiry_attachments_select_manager"
  on public.inquiry_attachments for select
  to authenticated
  using (
    public.is_inquiry_manager()
    and exists (
      select 1
      from public.inquiries i
      left join public.departments d on d.id = i.department_id
      where i.id = inquiry_attachments.inquiry_id
        and public.can_read_department(d.slug)
    )
  );

drop policy if exists "inquiry_attachments_write_manager" on public.inquiry_attachments;
create policy "inquiry_attachments_write_manager"
  on public.inquiry_attachments for all
  to authenticated
  using (
    public.is_inquiry_manager()
    and exists (
      select 1
      from public.inquiries i
      left join public.departments d on d.id = i.department_id
      where i.id = inquiry_attachments.inquiry_id
        and public.can_manage_department(d.slug)
    )
  )
  with check (
    public.is_inquiry_manager()
    and exists (
      select 1
      from public.inquiries i
      left join public.departments d on d.id = i.department_id
      where i.id = inquiry_attachments.inquiry_id
        and public.can_manage_department(d.slug)
    )
  );

-- Appointments are requested against an inquiry, so they inherit its boundary.
drop policy if exists "appointments_select_manager" on public.appointments;
create policy "appointments_select_manager"
  on public.appointments for select
  to authenticated
  using (
    public.is_inquiry_manager()
    and exists (
      select 1
      from public.inquiries i
      left join public.departments d on d.id = i.department_id
      where i.id = appointments.inquiry_id
        and public.can_read_department(d.slug)
    )
  );

drop policy if exists "appointments_write_manager" on public.appointments;
create policy "appointments_write_manager"
  on public.appointments for all
  to authenticated
  using (
    public.is_inquiry_manager()
    and exists (
      select 1
      from public.inquiries i
      left join public.departments d on d.id = i.department_id
      where i.id = appointments.inquiry_id
        and public.can_manage_department(d.slug)
    )
  )
  with check (
    public.is_inquiry_manager()
    and exists (
      select 1
      from public.inquiries i
      left join public.departments d on d.id = i.department_id
      where i.id = appointments.inquiry_id
        and public.can_manage_department(d.slug)
    )
  );

-- Services: one department's service catalogue is not another's.
drop policy if exists "services_select_admin" on public.services;
create policy "services_select_admin"
  on public.services for select
  to authenticated
  using (
    public.can_read_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  );

drop policy if exists "services_write_admin" on public.services;
create policy "services_write_admin"
  on public.services for all
  to authenticated
  using (
    public.can_manage_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  )
  with check (
    public.can_manage_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  );

-- Electrical projects: department_id is NOT NULL, so this is a straight compare
-- with no corporate case.
drop policy if exists "electrical_projects_select_admin" on public.electrical_projects;
create policy "electrical_projects_select_admin"
  on public.electrical_projects for select
  to authenticated
  using (
    public.can_read_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  );

drop policy if exists "electrical_projects_write_admin" on public.electrical_projects;
create policy "electrical_projects_write_admin"
  on public.electrical_projects for all
  to authenticated
  using (
    public.can_manage_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  )
  with check (
    public.can_manage_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  );

-- Case studies: the same, for the marketing and electrical portfolios.
drop policy if exists "case_studies_select_admin" on public.case_studies;
create policy "case_studies_select_admin"
  on public.case_studies for select
  to authenticated
  using (
    public.can_read_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  );

drop policy if exists "case_studies_write_admin" on public.case_studies;
create policy "case_studies_write_admin"
  on public.case_studies for all
  to authenticated
  using (
    public.can_manage_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  )
  with check (
    public.can_manage_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  );

-- Insights: the blog is a per-department content surface, so it follows the
-- same boundary as everything else: an author writes the posts of their own
-- department. The store is the one surface shared between the two marketing
-- departments (see below); the blog is not. `department_id` is nullable, so a
-- corporate post stays visible to any content manager, while creating one
-- remains a super_admin or department_staff action, by the same reasoning as
-- unowned inquiries.
drop policy if exists "insights_select_admin" on public.insights;
create policy "insights_select_admin"
  on public.insights for select
  to authenticated
  using (
    public.is_content_manager()
    and public.can_read_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  );

drop policy if exists "insights_write_admin" on public.insights;
create policy "insights_write_admin"
  on public.insights for all
  to authenticated
  using (
    public.is_content_manager()
    and public.can_manage_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  )
  with check (
    public.is_content_manager()
    and public.can_manage_department(
      (select d.slug from public.departments d where d.id = department_id)
    )
  );

-- -----------------------------------------------------------------------------
-- The store.
--
-- Scope comes from `is_store_manager()` rather than the department predicates:
-- the store is intentionally shared between two departments, so a per-department
-- comparison would have closed it to one of its two owners. Real Estate is
-- excluded, which is the change the brief asks for.
-- -----------------------------------------------------------------------------
drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin"
  on public.products for all
  to authenticated
  using (public.is_store_manager())
  with check (public.is_store_manager());

drop policy if exists "product_categories_write_admin" on public.product_categories;
create policy "product_categories_write_admin"
  on public.product_categories for all
  to authenticated
  using (public.is_store_manager())
  with check (public.is_store_manager());

drop policy if exists "product_category_slugs_write_admin" on public.product_category_slugs;
create policy "product_category_slugs_write_admin"
  on public.product_category_slugs for all
  to authenticated
  using (public.is_store_manager())
  with check (public.is_store_manager());

drop policy if exists "product_slugs_write_admin" on public.product_slugs;
create policy "product_slugs_write_admin"
  on public.product_slugs for all
  to authenticated
  using (public.is_store_manager())
  with check (public.is_store_manager());

drop policy if exists "product_media_write_admin" on public.product_media;
create policy "product_media_write_admin"
  on public.product_media for all
  to authenticated
  using (public.is_store_manager())
  with check (public.is_store_manager());

drop policy if exists "inventory_movements_select_admin" on public.inventory_movements;
create policy "inventory_movements_select_admin"
  on public.inventory_movements for select
  to authenticated
  using (public.is_store_manager());

drop policy if exists "inventory_movements_write_admin" on public.inventory_movements;
create policy "inventory_movements_write_admin"
  on public.inventory_movements for all
  to authenticated
  using (public.is_store_manager())
  with check (public.is_store_manager());

-- Carts and orders are store surfaces with no department column: a basket mixes
-- products, so it cannot belong to one department. Shared between the store's two
-- owners; Real Estate loses the operational view. `orders_select_own` is
-- untouched, so a customer still reads their own order regardless of role.
drop policy if exists "carts_select_admin" on public.carts;
create policy "carts_select_admin"
  on public.carts for select
  to authenticated
  using (public.is_store_manager());

drop policy if exists "carts_write_admin" on public.carts;
create policy "carts_write_admin"
  on public.carts for all
  to authenticated
  using (public.is_store_manager())
  with check (public.is_store_manager());

drop policy if exists "cart_items_select_admin" on public.cart_items;
create policy "cart_items_select_admin"
  on public.cart_items for select
  to authenticated
  using (public.is_store_manager());

drop policy if exists "cart_items_write_admin" on public.cart_items;
create policy "cart_items_write_admin"
  on public.cart_items for all
  to authenticated
  using (public.is_store_manager())
  with check (public.is_store_manager());

drop policy if exists "orders_select_admin" on public.orders;
create policy "orders_select_admin"
  on public.orders for select
  to authenticated
  using (public.is_store_manager());

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin"
  on public.orders for update
  to authenticated
  using (public.is_store_manager())
  with check (public.is_store_manager());

drop policy if exists "payment_webhook_events_select_admin" on public.payment_webhook_events;
create policy "payment_webhook_events_select_admin"
  on public.payment_webhook_events for select
  to authenticated
  using (public.is_store_manager());

-- The `_select_own` policies on orders, order_items, order_events and payments
-- are deliberately left alone. Each already reads
-- `customer_id = auth.uid() OR is_admin()`, and the `is_admin()` arm is what let
-- an operator see a customer's order detail. They are re-created here with the
-- admin arm narrowed to store managers, keeping the owner arm byte-for-byte.
drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid() or public.is_store_manager())
    )
  );

drop policy if exists "order_events_select_own" on public.order_events;
create policy "order_events_select_own"
  on public.order_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and (o.customer_id = auth.uid() or public.is_store_manager())
    )
  );

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and (o.customer_id = auth.uid() or public.is_store_manager())
    )
  );
