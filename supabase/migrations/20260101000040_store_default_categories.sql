-- -----------------------------------------------------------------------------
-- Default store categories.
--
-- `products.category_id` is NOT NULL, so with no category rows the admin's
-- "Add a product" page has nothing to attach a product to and renders the
-- "store is not connected" notice instead of the form. That is exactly what
-- happened: the schema shipped without any category, and the create flow was
-- unusable.
--
-- These are TAXONOMY, not commercial claims. They name the kinds of thing the
-- store sells, with no price, stock or product attached, so they do not put a
-- fabricated offer on a public path. Real product content is still only ever
-- created by an administrator.
--
-- Published rather than draft, deliberately. A product's public visibility
-- requires its category to be published too (`products_select_published`), so a
-- draft-only taxonomy would make every product an administrator publishes
-- invisible on the site — the same dead end as having no category at all. The
-- publish gate that matters for a commercial claim is the product's own, and it
-- is unaffected. Departments are seeded active for the same reason.
--
-- Guarded on the department having no categories, so an operator who has already
-- organized their own catalogue is never overwritten by this migration.
-- -----------------------------------------------------------------------------
insert into public.product_categories (department_id, slug, name, sort_order, is_active, publish_state)
select
  d.id,
  seed.slug,
  seed.name,
  seed.sort_order,
  true,
  'published'
from public.departments d
cross join (
  values
    ('computers-and-accessories', 'Computers & Accessories', 10),
    ('networking',                'Networking',              20),
    ('power-and-solar',           'Power & Solar',           30),
    ('security-and-surveillance', 'Security & Surveillance', 40),
    ('software-and-licences',     'Software & Licences',     50)
) as seed(slug, name, sort_order)
where d.slug = 'digital-marketing'
  and not exists (
    select 1
    from public.product_categories c
    where c.department_id = d.id
  );

-- French labels for the seeded categories, mirroring how department labels are
-- translated in the seed. Marked `translated` so the localized store renders.
insert into public.content_translations
  (entity_type, entity_id, field_name, locale, value, state, source_locale, translated_at)
select
  'category',
  c.id,
  'name',
  'fr',
  case c.slug
    when 'computers-and-accessories' then 'Ordinateurs et accessoires'
    when 'networking'                then 'Réseautique'
    when 'power-and-solar'           then 'Énergie et solaire'
    when 'security-and-surveillance' then 'Sécurité et surveillance'
    when 'software-and-licences'     then 'Logiciels et licences'
  end,
  'translated',
  'en',
  now()
from public.product_categories c
where c.slug in (
  'computers-and-accessories',
  'networking',
  'power-and-solar',
  'security-and-surveillance',
  'software-and-licences'
)
on conflict (entity_type, entity_id, field_name, locale) do nothing;
