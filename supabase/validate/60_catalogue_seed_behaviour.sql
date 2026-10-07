-- =============================================================================
-- Behavioural validation of the seeded catalogue.
--
-- The defect this guards against
-- ----------------------------
-- `20260101000040_store_default_categories.sql` and
-- `20260101000045_electrical_solar_packages.sql` insert rows by selecting from
-- `public.departments`, but the departments were only inserted by
-- `supabase/seed.sql`. Supabase applies migrations before seed, so on a fresh
-- database both inserts matched no department and silently did nothing: the store
-- had no categories and the nine solar packages never existed. Every local check
-- passed because the database being checked had been seeded once and kept.
--
-- This file runs on migrations alone (the harness never applies `seed.sql`), so
-- it fails unless the migration set itself creates the departments, the store
-- categories and the published solar products.
--
-- It is deliberately not an exact-count assertion: the behaviour files run in
-- filename order against one database and the store fixtures in
-- `10_store_behaviour.sql` add their own categories. It asserts that the rows the
-- application depends on are present and correctly publishable.
-- =============================================================================

do $$
declare
  v_count integer;
begin
  -- ---------------------------------------------------------------------------
  -- 1. The three departments exist after migrations alone.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.departments
   where slug in ('digital-marketing', 'electrical-services', 'real-estate');
  if v_count <> 3 then
    raise exception 'VALIDATION FAIL: expected the 3 departments from migrations, found %', v_count;
  end if;
  raise notice 'PASS  departments seeded at migration time';

  -- ---------------------------------------------------------------------------
  -- 2. Digital Marketing has its default store taxonomy, published so that a
  --    product an admin publishes is actually visible.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.product_categories c
    join public.departments d on d.id = c.department_id
   where d.slug = 'digital-marketing'
     and c.slug in (
       'computers-and-accessories', 'networking', 'power-and-solar',
       'security-and-surveillance', 'software-and-licences'
     )
     and c.publish_state = 'published';
  if v_count <> 5 then
    raise exception 'VALIDATION FAIL: expected 5 published Digital Marketing categories, found %', v_count;
  end if;
  raise notice 'PASS  store categories seeded at migration time';

  -- ---------------------------------------------------------------------------
  -- 3. The four Electrical Services solar categories exist and are published.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.product_categories c
    join public.departments d on d.id = c.department_id
   where d.slug = 'electrical-services'
     and c.slug in ('ess-starter', 'medium-home', 'large-home-business', 'ultra-large-premium')
     and c.publish_state = 'published';
  if v_count <> 4 then
    raise exception 'VALIDATION FAIL: expected 4 published solar categories, found %', v_count;
  end if;
  raise notice 'PASS  solar categories seeded at migration time';

  -- ---------------------------------------------------------------------------
  -- 4. All nine solar packages are published products with a price, an image and
  --    a French slug. `products_publish_requires_media` is a BEFORE INSERT
  --    trigger, so publishing only works if the seed creates the product as a
  --    draft, attaches media, and publishes afterwards — this asserts the result
  --    of that order rather than the mechanism.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.products pr
    join public.product_categories c on c.id = pr.category_id
    join public.departments d on d.id = c.department_id
   where d.slug = 'electrical-services'
     and pr.sku like 'KC-SOLAR-%'
     and pr.publish_state = 'published'
     and pr.price_minor > 0
     and pr.currency = 'XAF'
     and exists (select 1 from public.product_media m where m.product_id = pr.id)
     and exists (
       select 1 from public.product_slugs s
        where s.product_id = pr.id and s.locale = 'fr'
     );
  if v_count <> 9 then
    raise exception 'VALIDATION FAIL: expected 9 published solar packages with media and FR slug, found %', v_count;
  end if;
  raise notice 'PASS  nine solar packages published with media and FR slugs';

  -- ---------------------------------------------------------------------------
  -- 5. The solar products are reachable with the anonymous key the public package
  --    pages use, i.e. RLS shows them. Without this the "Add to cart" control
  --    silently degrades to request-info only.
  -- ---------------------------------------------------------------------------
  set local role anon;
  select count(*) into v_count
    from public.products
   where sku like 'KC-SOLAR-%' and publish_state = 'published';
  reset role;
  if v_count <> 9 then
    raise exception 'VALIDATION FAIL: anon sees % published solar products, expected 9', v_count;
  end if;
  raise notice 'PASS  solar products are anon-visible';
end
$$;
