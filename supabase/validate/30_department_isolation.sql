-- =============================================================================
-- Behavioural validation of department-scoped administration
-- (migration 20260101000038_department_administration.sql).
--
-- Run after the migrations. Every check either raises, which aborts the run, or
-- asserts a condition that must hold. Actors are impersonated by setting
-- `request.jwt.claim.sub`, which is how the shim's `auth.uid()` resolves the user
-- and therefore how the security-definer role helpers read `profiles`.
--
-- What this proves, in order:
--   1. A department admin reads only their own department's inquiries.
--   2. They cannot update another department's inquiries.
--   3. super_admin and department_staff stay cross-department.
--   4. A corporate (department-less) inquiry is visible to admin roles, because
--      it is not another department's private data.
--   5. Real-estate agents see no inquiries.
--   6. Services are scoped to their department.
--   7. Content is per-department and closed to Real Estate.
--   8. The store is shared by Digital Marketing and Electrical Services, read by
--      neither Real Estate admin nor an agent.
--   9. Order visibility follows ownership and the store boundary.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Actors. One per department, plus the cross-department roles and a customer.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'mkt-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'elec-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000b3', 're-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000b4', 'super@test.local'),
  ('00000000-0000-0000-0000-0000000000b5', 'staff@test.local'),
  ('00000000-0000-0000-0000-0000000000b6', 'agent@test.local'),
  ('00000000-0000-0000-0000-0000000000b7', 'customer@test.local')
on conflict (id) do nothing;

insert into public.profiles (id, email, role, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'mkt-admin@test.local', 'digital_marketing_admin', 'Mkt Admin'),
  ('00000000-0000-0000-0000-0000000000b2', 'elec-admin@test.local', 'electrical_admin',       'Elec Admin'),
  ('00000000-0000-0000-0000-0000000000b3', 're-admin@test.local',   'real_estate_admin',      'RE Admin'),
  ('00000000-0000-0000-0000-0000000000b4', 'super@test.local',      'super_admin',            'Super'),
  ('00000000-0000-0000-0000-0000000000b5', 'staff@test.local',      'department_staff',       'Staff'),
  ('00000000-0000-0000-0000-0000000000b6', 'agent@test.local',      'real_estate_agent',      'Agent'),
  ('00000000-0000-0000-0000-0000000000b7', 'customer@test.local',   'customer',               'Customer')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

-- -----------------------------------------------------------------------------
-- Fixtures: one inquiry per department, plus one corporate inquiry.
-- -----------------------------------------------------------------------------
insert into public.inquiries (reference, full_name, email, subject, message, source, department_id, status, priority)
select 'KC-20260201-MKT001', 'A', 'a@test.local', 'Mkt subject', 'marketing question', 'contact_form', d.id, 'new', 'normal'
from public.departments d where d.slug = 'digital-marketing'
on conflict (reference) do nothing;

insert into public.inquiries (reference, full_name, email, subject, message, source, department_id, status, priority)
select 'KC-20260201-ELE001', 'B', 'b@test.local', 'Elec subject', 'electrical quote', 'quote_request', d.id, 'new', 'normal'
from public.departments d where d.slug = 'electrical-services'
on conflict (reference) do nothing;

insert into public.inquiries (reference, full_name, email, subject, message, source, department_id, status, priority)
select 'KC-20260201-REA001', 'C', 'c@test.local', 'RE subject', 'property viewing', 'property_inquiry', d.id, 'new', 'normal'
from public.departments d where d.slug = 'real-estate'
on conflict (reference) do nothing;

insert into public.inquiries (reference, full_name, email, subject, message, source, department_id, status, priority)
values ('KC-20260201-COR001', 'D', 'd@test.local', 'Corporate subject', 'general corporate question', 'contact_form', null, 'new', 'normal')
on conflict (reference) do nothing;

-- One service and one insight per department.
insert into public.services (department_id, slug, title, summary, description, is_active, publish_state)
select d.id, 'svc-'||d.slug, 'Service '||d.name, 'summary', 'body', true, 'draft'
from public.departments d
on conflict (department_id, slug) do nothing;

insert into public.insights (department_id, slug, title, summary, body, publish_state)
select d.id, 'ins-'||d.slug, 'Insight '||d.name, 'summary', 'body', 'draft'
from public.departments d
on conflict (slug) do nothing;

-- A category and product owned by Digital Marketing, for the store checks.
insert into public.product_categories (department_id, slug, name, publish_state)
select d.id, 'cat-store-check', 'Store Check', 'draft'
from public.departments d where d.slug = 'digital-marketing'
on conflict (slug) do nothing;

insert into public.products (category_id, slug, sku, title, short_description, description, price_minor, publish_state)
select c.id, 'prod-store-check', 'SKU-STORE-CHECK', 'Store Check Product', 'short', 'long', 1000, 'draft'
from public.product_categories c where c.slug = 'cat-store-check'
on conflict (sku) do nothing;

-- An order owned by the customer, for the order-visibility checks.
insert into public.orders (reference, email, full_name, idempotency_key, access_token, currency, fulfillment, subtotal_minor, total_minor)
values ('KC-ORD-20260201-AAA001', 'customer@test.local', 'Customer', 'idem-dept-check-1', '0123456789abcdef0123456789abcdef', 'XAF', 'pickup', 1000, 1000)
on conflict (reference) do nothing;

update public.orders
   set customer_id = '00000000-0000-0000-0000-0000000000b7'
 where reference = 'KC-ORD-20260201-AAA001';


-- =============================================================================
-- Checks
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. A department admin reads only their own department's inquiry, plus the
--    corporate one that belongs to no department.
-- -----------------------------------------------------------------------------
do $$
declare v_mkt text; v_elec text; v_re text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  select coalesce(string_agg(reference, ',' order by reference), '') into v_mkt
  from public.inquiries where reference like 'KC-20260201-%';
  if v_mkt <> 'KC-20260201-COR001,KC-20260201-MKT001' then
    raise exception 'VALIDATION FAIL: digital marketing admin saw [%]', v_mkt;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  set local role authenticated;
  select coalesce(string_agg(reference, ',' order by reference), '') into v_elec
  from public.inquiries where reference like 'KC-20260201-%';
  if v_elec <> 'KC-20260201-COR001,KC-20260201-ELE001' then
    raise exception 'VALIDATION FAIL: electrical admin saw [%]', v_elec;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
  set local role authenticated;
  select coalesce(string_agg(reference, ',' order by reference), '') into v_re
  from public.inquiries where reference like 'KC-20260201-%';
  if v_re <> 'KC-20260201-COR001,KC-20260201-REA001' then
    raise exception 'VALIDATION FAIL: real estate admin saw [%]', v_re;
  end if;
  reset role;

  raise notice 'PASS  1. department admins read only their own department';
end
$$;

-- -----------------------------------------------------------------------------
-- 2. They cannot update another department's inquiry, and can update their own.
-- -----------------------------------------------------------------------------
do $$
declare v_rows int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  update public.inquiries set priority = 'high' where reference = 'KC-20260201-ELE001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'VALIDATION FAIL: marketing admin updated % electrical inquiries', v_rows;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  update public.inquiries set priority = 'high' where reference = 'KC-20260201-MKT001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDATION FAIL: marketing admin could not update its own inquiry (% rows)', v_rows;
  end if;
  reset role;

  raise notice 'PASS  2. cross-department writes are blocked, own-department writes allowed';
end
$$;

-- -----------------------------------------------------------------------------
-- 3. super_admin and department_staff remain cross-department.
-- -----------------------------------------------------------------------------
do $$
declare v_super int; v_staff int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b4', true);
  set local role authenticated;
  select count(*) into v_super from public.inquiries where reference like 'KC-20260201-%';
  if v_super <> 4 then
    raise exception 'VALIDATION FAIL: super_admin saw % of 4 inquiries', v_super;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);
  set local role authenticated;
  select count(*) into v_staff from public.inquiries where reference like 'KC-20260201-%';
  if v_staff <> 4 then
    raise exception 'VALIDATION FAIL: department_staff saw % of 4 inquiries', v_staff;
  end if;
  reset role;

  raise notice 'PASS  3. super_admin and department_staff stay cross-department';
end
$$;

-- -----------------------------------------------------------------------------
-- 4. A real-estate agent sees no inquiry at all: it manages listings, not the
--    pipeline. (Migration 21 excludes it from `is_inquiry_manager`.)
-- -----------------------------------------------------------------------------
do $$
declare v_agent int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
  set local role authenticated;
  select count(*) into v_agent from public.inquiries where reference like 'KC-20260201-%';
  if v_agent <> 0 then
    raise exception 'VALIDATION FAIL: an agent saw % inquiries', v_agent;
  end if;
  reset role;

  raise notice 'PASS  4. a real-estate agent sees no inquiries';
end
$$;

-- -----------------------------------------------------------------------------
-- 5. Services are scoped to the owning department.
-- -----------------------------------------------------------------------------
do $$
declare v_mkt int; v_elec_sees_mkt int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  select count(*) into v_mkt from public.services where slug = 'svc-digital-marketing';
  if v_mkt <> 1 then
    raise exception 'VALIDATION FAIL: marketing admin cannot read its own service';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  set local role authenticated;
  select count(*) into v_elec_sees_mkt from public.services where slug = 'svc-digital-marketing';
  if v_elec_sees_mkt <> 0 then
    raise exception 'VALIDATION FAIL: electrical admin read a marketing service';
  end if;
  reset role;

  raise notice 'PASS  5. services are department-scoped';
end
$$;

-- -----------------------------------------------------------------------------
-- 6. Content is per-department: closed to Real Estate, and a marketing author
--    does not touch the other department's blog.
-- -----------------------------------------------------------------------------
do $$
declare v_mkt_own int; v_mkt_other int; v_re int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  select count(*) into v_mkt_own from public.insights where slug = 'ins-digital-marketing';
  if v_mkt_own <> 1 then
    raise exception 'VALIDATION FAIL: marketing admin cannot read its own insight';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  select count(*) into v_mkt_other from public.insights where slug = 'ins-electrical-services';
  if v_mkt_other <> 0 then
    raise exception 'VALIDATION FAIL: marketing admin read the electrical department''s insight';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
  set local role authenticated;
  select count(*) into v_re from public.insights where slug like 'ins-%';
  if v_re <> 0 then
    raise exception 'VALIDATION FAIL: real estate admin saw % insights, expected 0', v_re;
  end if;
  reset role;

  raise notice 'PASS  6. content is per-department and closed to real estate';
end
$$;

-- -----------------------------------------------------------------------------
-- 7. The store: shared by the two marketing departments, closed to real estate
--    and to agents.
-- -----------------------------------------------------------------------------
do $$
declare v_mkt int; v_elec int; v_re int; v_agent int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  select count(*) into v_mkt from public.products where sku = 'SKU-STORE-CHECK';
  if v_mkt <> 1 then
    raise exception 'VALIDATION FAIL: marketing admin cannot manage the store';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  set local role authenticated;
  select count(*) into v_elec from public.products where sku = 'SKU-STORE-CHECK';
  if v_elec <> 1 then
    raise exception 'VALIDATION FAIL: electrical admin cannot manage the shared store';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
  set local role authenticated;
  select count(*) into v_re from public.products where sku = 'SKU-STORE-CHECK';
  if v_re <> 0 then
    raise exception 'VALIDATION FAIL: real estate admin read the store';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
  set local role authenticated;
  select count(*) into v_agent from public.products where sku = 'SKU-STORE-CHECK';
  if v_agent <> 0 then
    raise exception 'VALIDATION FAIL: an agent read the store';
  end if;
  reset role;

  raise notice 'PASS  7. store shared by marketing and electrical, closed to real estate and agents';
end
$$;

-- -----------------------------------------------------------------------------
-- 8. Orders: the customer still reads their own, a store manager reads the
--    queue, and a real-estate admin does not.
-- -----------------------------------------------------------------------------
do $$
declare v_cust int; v_mkt int; v_re int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b7', true);
  set local role authenticated;
  select count(*) into v_cust from public.orders where reference = 'KC-ORD-20260201-AAA001';
  if v_cust <> 1 then
    raise exception 'VALIDATION FAIL: the customer cannot read their own order';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  select count(*) into v_mkt from public.orders where reference = 'KC-ORD-20260201-AAA001';
  if v_mkt <> 1 then
    raise exception 'VALIDATION FAIL: a store manager cannot read the order queue';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
  set local role authenticated;
  select count(*) into v_re from public.orders where reference = 'KC-ORD-20260201-AAA001';
  if v_re <> 0 then
    raise exception 'VALIDATION FAIL: real estate admin read the store order queue';
  end if;
  reset role;

  raise notice 'PASS  8. order visibility follows ownership and the store boundary';
end
$$;

\echo ''
\echo 'Department isolation: all checks passed.'
