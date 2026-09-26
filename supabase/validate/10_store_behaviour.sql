-- =============================================================================
-- Behavioural validation of the Phase 4 store schema.
--
-- Run after the migrations. Every check either raises, which aborts the run, or
-- asserts a condition that must hold. This is the same SQL the acceptance
-- criteria describe, executed against a real PostgreSQL instance.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
insert into public.departments (slug, name, accent_color, sort_order, is_active)
values ('digital-marketing', 'Digital Marketing', '#1E6FD9', 10, true)
on conflict (slug) do nothing;

insert into public.product_categories (department_id, slug, name, publish_state)
select id, 'laptops', 'Laptops', 'published'
from public.departments where slug = 'digital-marketing'
on conflict (slug) do nothing;

insert into public.product_categories (department_id, slug, name, publish_state)
select id, 'draft-category', 'Draft Category', 'draft'
from public.departments where slug = 'digital-marketing'
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- 1. GTIN validation: a valid GTIN-13 is accepted, an invalid check digit is not.
-- -----------------------------------------------------------------------------
do $$
begin
  if not public.gtin_is_valid('4006381333931') then
    raise exception 'VALIDATION FAIL: a correct GTIN-13 was rejected';
  end if;
  if public.gtin_is_valid('4006381333932') then
    raise exception 'VALIDATION FAIL: a bad GTIN check digit was accepted';
  end if;
  if public.gtin_is_valid('12345') then
    raise exception 'VALIDATION FAIL: an over-short GTIN was accepted';
  end if;
  if not public.gtin_is_valid(null) then
    raise exception 'VALIDATION FAIL: a null GTIN must be allowed';
  end if;
  raise notice 'PASS  gtin_is_valid';
end
$$;

-- -----------------------------------------------------------------------------
-- 2. A product cannot be created with a malformed GTIN.
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    insert into public.products (
      category_id, slug, sku, title, short_description, description,
      price_minor, gtin
    )
    select id, 'bad-gtin-product', 'SKU-BADGTIN', 'Bad GTIN', 'short', 'long', 1000,
           '4006381333932'
    from public.product_categories where slug = 'laptops';
    raise exception 'VALIDATION FAIL: a malformed GTIN was stored';
  exception
    when check_violation then
      raise notice 'PASS  malformed GTIN rejected';
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- 3. Availability is derived from stock.
-- -----------------------------------------------------------------------------
insert into public.products (
  category_id, slug, sku, title, short_description, description,
  price_minor, stock, brand, gtin, publish_state
)
select id, 'thinkpad-x1', 'KC-TPX1-01', 'ThinkPad X1 Carbon',
       'A lightweight business laptop.', 'A lightweight business laptop with a 14-inch display.',
       850000, 5, 'Lenovo', '4006381333931', 'draft'
from public.product_categories where slug = 'laptops'
on conflict (slug) do nothing;

do $$
declare
  v public.product_availability;
begin
  select availability into v from public.products where slug = 'thinkpad-x1';
  if v <> 'in_stock' then
    raise exception 'VALIDATION FAIL: stock 5 should derive in_stock, got %', v;
  end if;

  update public.products set stock = 0 where slug = 'thinkpad-x1';
  select availability into v from public.products where slug = 'thinkpad-x1';
  if v <> 'out_of_stock' then
    raise exception 'VALIDATION FAIL: stock 0 should derive out_of_stock, got %', v;
  end if;

  -- An override wins, which is how preorder/backorder are expressed.
  update public.products
  set stock = 3, availability_override = 'preorder'
  where slug = 'thinkpad-x1';
  select availability into v from public.products where slug = 'thinkpad-x1';
  if v <> 'preorder' then
    raise exception 'VALIDATION FAIL: override should win, got %', v;
  end if;

  update public.products set availability_override = null where slug = 'thinkpad-x1';
  raise notice 'PASS  availability derived from stock';
end
$$;

-- -----------------------------------------------------------------------------
-- 4. Negative stock is unrepresentable.
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    update public.products set stock = -1 where slug = 'thinkpad-x1';
    raise exception 'VALIDATION FAIL: negative stock was stored';
  exception
    when check_violation then
      raise notice 'PASS  negative stock rejected';
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- 5. Inventory ledger drives stock and refuses to go negative.
-- -----------------------------------------------------------------------------
do $$
declare
  pid uuid;
  after integer;
begin
  select id into pid from public.products where slug = 'thinkpad-x1';

  insert into public.inventory_movements (product_id, delta, reason)
  values (pid, 10, 'restock');

  select stock, stock_after into after, after
  from public.products p, public.inventory_movements m
  where p.id = pid and m.product_id = pid
  order by m.created_at desc limit 1;

  if after <> 13 then
    raise exception 'VALIDATION FAIL: stock should be 13 after +10 from 3, got %', after;
  end if;

  begin
    insert into public.inventory_movements (product_id, delta, reason)
    values (pid, -100, 'correction');
    raise exception 'VALIDATION FAIL: an over-draw was allowed';
  exception
    when check_violation then
      raise notice 'PASS  inventory ledger guards negative stock';
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- 6. A product cannot be published without an image, and can once it has one.
-- -----------------------------------------------------------------------------
do $$
declare
  pid uuid;
begin
  select id into pid from public.products where slug = 'thinkpad-x1';

  begin
    update public.products set publish_state = 'published', published_at = now()
    where id = pid;
    raise exception 'VALIDATION FAIL: published a product with no image';
  exception
    when check_violation then
      raise notice 'PASS  publishing without an image rejected';
  end;

  insert into public.product_media (product_id, storage_path, alt_text, is_primary)
  values (pid, 'products/thinkpad-x1/front.jpg', 'ThinkPad X1 Carbon, front view', true);

  update public.products set publish_state = 'published', published_at = now()
  where id = pid;

  if (select publish_state from public.products where id = pid) <> 'published' then
    raise exception 'VALIDATION FAIL: product should now be published';
  end if;
  raise notice 'PASS  publishing with an image allowed';
end
$$;

-- -----------------------------------------------------------------------------
-- 7. Translation index: deterministic keys, complete field coverage, idempotency.
-- -----------------------------------------------------------------------------
do $$
declare
  pid uuid;
  entry_count integer;
  job_count integer;
  expected text;
begin
  select id into pid from public.products where slug = 'thinkpad-x1';

  -- SEO overrides are written separately; the seo_* keys should appear after.
  insert into public.entity_seo (entity_type, entity_id, locale, title, description)
  values ('product', pid, 'en', 'Buy the ThinkPad X1 Carbon in Cameroon',
          'Lenovo ThinkPad X1 Carbon available from KC Technology Corporation.')
  on conflict (entity_type, entity_id, locale) do update
    set title = excluded.title, description = excluded.description;

  -- Five product fields carry a value (slug, name, short_description,
  -- description) plus the two seo fields = six index rows.
  select count(*) into entry_count
  from public.translation_entries
  where entity_type = 'product' and entity_id = pid;

  if entry_count <> 6 then
    raise exception 'VALIDATION FAIL: expected 6 translation entries, got %', entry_count;
  end if;

  -- Keys are deterministic and match the required shape.
  expected := 'product.' || pid::text || '.name.en';
  if not exists (
    select 1 from public.translation_entries
    where translation_key = expected
  ) then
    raise exception 'VALIDATION FAIL: missing deterministic key %', expected;
  end if;

  if exists (
    select 1 from public.translation_entries
    where entity_id = pid
      and translation_key <> public.build_translation_key(
        'product', entity_id, field_name, 'en'
      )
  ) then
    raise exception 'VALIDATION FAIL: a key does not match build_translation_key()';
  end if;

  select count(*) into job_count
  from public.translation_sync_jobs j
  join public.translation_entries e on e.id = j.translation_entry_id
  where e.entity_id = pid;
  if job_count <> 6 then
    raise exception 'VALIDATION FAIL: expected 6 queued jobs, got %', job_count;
  end if;

  -- Re-saving the same product must not duplicate anything.
  update public.products set title = title where id = pid;
  update public.products
  set short_description = 'A lightweight business laptop.'
  where id = pid;

  select count(*) into entry_count
  from public.translation_entries
  where entity_type = 'product' and entity_id = pid;
  if entry_count <> 6 then
    raise exception 'VALIDATION FAIL: re-save duplicated entries (now %)', entry_count;
  end if;

  select count(*) into job_count
  from public.translation_sync_jobs j
  join public.translation_entries e on e.id = j.translation_entry_id
  where e.entity_id = pid;
  if job_count <> 6 then
    raise exception 'VALIDATION FAIL: re-save duplicated jobs (now %)', job_count;
  end if;

  raise notice 'PASS  translation index deterministic and idempotent';
end
$$;

-- -----------------------------------------------------------------------------
-- 8. Changing English marks French outdated and does not overwrite it.
-- -----------------------------------------------------------------------------
do $$
declare
  pid uuid;
  fr_state public.translation_state;
  fr_value text;
begin
  select id into pid from public.products where slug = 'thinkpad-x1';

  -- Simulate a completed French translation.
  update public.content_translations
  set value = 'Un ordinateur portable professionnel léger.',
      state = 'translated',
      translated_at = now(),
      source_updated_at = now() - interval '1 day'
  where entity_type = 'product' and entity_id = pid
    and field_name = 'short_description' and locale = 'fr';

  update public.products
  set short_description = 'A lightweight business laptop built for travel.'
  where id = pid;

  select state, value into fr_state, fr_value
  from public.content_translations
  where entity_type = 'product' and entity_id = pid
    and field_name = 'short_description' and locale = 'fr';

  if fr_state <> 'outdated' then
    raise exception 'VALIDATION FAIL: French should be outdated, got %', fr_state;
  end if;
  if fr_value <> 'Un ordinateur portable professionnel léger.' then
    raise exception 'VALIDATION FAIL: the French translation was overwritten: %', fr_value;
  end if;
  raise notice 'PASS  English change marks French outdated without overwriting';
end
$$;

-- -----------------------------------------------------------------------------
-- 9. Queue transitions: claim, fail with backoff, exhaust, requeue.
-- -----------------------------------------------------------------------------
do $$
declare
  claimed integer;
  job_id uuid;
  job_status public.sync_state;
  job_attempts integer;
begin
  select count(*) into claimed from public.claim_translation_sync_jobs(100);
  if claimed < 1 then
    raise exception 'VALIDATION FAIL: no jobs were claimed';
  end if;

  select id into job_id from public.translation_sync_jobs
  where status = 'syncing' limit 1;

  -- First failure returns the job to the queue for a retry.
  perform public.fail_translation_sync_job(job_id, 'Tolgee unreachable');
  select status, attempts into job_status, job_attempts
  from public.translation_sync_jobs where id = job_id;
  if job_status <> 'queued' then
    raise exception 'VALIDATION FAIL: a failed first attempt should re-queue, got %', job_status;
  end if;
  if job_attempts <> 1 then
    raise exception 'VALIDATION FAIL: attempts should be 1, got %', job_attempts;
  end if;

  -- Exhaust the remaining attempts.
  update public.translation_sync_jobs set attempts = max_attempts where id = job_id;
  update public.translation_sync_jobs set status = 'syncing' where id = job_id;
  perform public.fail_translation_sync_job(job_id, 'Tolgee still unreachable');
  select status into job_status from public.translation_sync_jobs where id = job_id;
  if job_status <> 'failed' then
    raise exception 'VALIDATION FAIL: an exhausted job should be failed, got %', job_status;
  end if;

  -- Manual recovery path.
  perform public.requeue_translation_entry(
    (select translation_entry_id from public.translation_sync_jobs where id = job_id)
  );
  select status, attempts into job_status, job_attempts
  from public.translation_sync_jobs where id = job_id;
  if job_status <> 'queued' or job_attempts <> 0 then
    raise exception 'VALIDATION FAIL: requeue did not reset the job (%, %)', job_status, job_attempts;
  end if;

  raise notice 'PASS  sync queue claim/fail/backoff/requeue';
end
$$;

-- -----------------------------------------------------------------------------
-- 10. Successful sync records the Tolgee key id.
-- -----------------------------------------------------------------------------
do $$
declare
  job_id uuid;
  entry_id uuid;
begin
  select j.id, j.translation_entry_id into job_id, entry_id
  from public.translation_sync_jobs j
  where j.status = 'queued' limit 1;

  update public.translation_sync_jobs set status = 'syncing' where id = job_id;
  perform public.complete_translation_sync_job(job_id, 'tolgee-key-42');

  if (select sync_state from public.translation_entries where id = entry_id) <> 'synced' then
    raise exception 'VALIDATION FAIL: entry should be synced';
  end if;
  if (select tolgee_key_id from public.translation_entries where id = entry_id) <> 'tolgee-key-42' then
    raise exception 'VALIDATION FAIL: tolgee_key_id was not recorded';
  end if;
  if (select last_synced_at from public.translation_entries where id = entry_id) is null then
    raise exception 'VALIDATION FAIL: last_synced_at was not recorded';
  end if;
  raise notice 'PASS  successful sync records key id and timestamp';
end
$$;

-- -----------------------------------------------------------------------------
-- 11. RLS: anon sees only published catalogue rows; drafts stay hidden.
-- -----------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  insert into public.products (
    category_id, slug, sku, title, short_description, description,
    price_minor, stock, publish_state
  )
  select id, 'draft-product', 'KC-DRAFT-01', 'Draft Product', 'Not for sale yet.',
         'A product that has not been published.', 1000, 2, 'draft'
  from public.product_categories where slug = 'laptops'
  on conflict (slug) do nothing;

  -- A published product in a DRAFT category must also stay hidden. It is created
  -- as a draft and published after attaching an image, because the schema
  -- refuses to publish an unillustrated product.
  insert into public.products (
    category_id, slug, sku, title, short_description, description,
    price_minor, stock, publish_state
  )
  select id, 'hidden-product', 'KC-HIDDEN-01', 'Hidden Product', 'Category is a draft.',
         'A product whose category is unpublished.', 2000, 1, 'draft'
  from public.product_categories where slug = 'draft-category'
  on conflict (slug) do nothing;

  insert into public.product_media (product_id, storage_path, alt_text, is_primary)
  select id, 'products/hidden-product/front.jpg', 'Hidden Product, front view', true
  from public.products where slug = 'hidden-product'
  on conflict do nothing;

  update public.products
  set publish_state = 'published', published_at = now()
  where slug = 'hidden-product';

  set local role anon;
  select count(*) into visible from public.products;
  reset role;

  if visible <> 1 then
    raise exception 'VALIDATION FAIL: anon should see exactly 1 product, saw %', visible;
  end if;
  raise notice 'PASS  RLS hides drafts and products in draft categories';
end
$$;

-- -----------------------------------------------------------------------------
-- 12. Localized slugs are unique per locale and never hold the source locale.
-- -----------------------------------------------------------------------------
do $$
declare
  pid uuid;
begin
  select id into pid from public.products where slug = 'thinkpad-x1';

  insert into public.product_slugs (product_id, locale, slug)
  values (pid, 'fr', 'ordinateur-portable-thinkpad-x1');

  if not exists (
    select 1 from public.content_translations
    where entity_type = 'product' and entity_id = pid
      and field_name = 'slug' and locale = 'fr'
      and value = 'ordinateur-portable-thinkpad-x1'
  ) then
    raise exception 'VALIDATION FAIL: the French slug was not mirrored into content_translations';
  end if;

  begin
    insert into public.product_slugs (product_id, locale, slug)
    values (pid, 'en', 'thinkpad-x1-english');
    raise exception 'VALIDATION FAIL: a source-locale slug was stored';
  exception
    when check_violation then
      raise notice 'PASS  localized slug rules enforced';
  end;
end
$$;

select 'ALL PHASE 4 SCHEMA VALIDATIONS PASSED' as result;
