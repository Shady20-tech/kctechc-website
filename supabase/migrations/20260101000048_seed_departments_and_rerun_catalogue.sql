-- =============================================================================
-- Seed the three departments at migration time, and re-run the catalogue
-- inserts that depended on them.
--
-- The defect this fixes
-- --------------------
-- `20260101000040_store_default_categories.sql` and
-- `20260101000045_electrical_solar_packages.sql` both insert rows by selecting
-- from `public.departments`, but the departments themselves were only inserted
-- by `supabase/seed.sql`. Supabase applies migrations first and seeds last, so
-- on a fresh database both inserts matched ZERO departments and did nothing:
-- the store had no categories, the "Add a product" page had nothing to attach a
-- product to, and the nine solar package products never existed.
--
-- It stayed invisible because local work is usually validated against a
-- long-lived database that had been seeded once. This migration makes the
-- department rows part of the schema (as taxonomy, like the categories), so the
-- catalogue inserts have something to select from on any fresh database.
--
-- Idempotent throughout: guarded on absence and `on conflict do nothing`, so it
-- is safe on a database that already has the rows.
--
-- `accent_color` is left null: the rendered department accents are the
-- department-scoped theme tokens in `src/app/globals.css`, and the stored column
-- is unused by the application. Duplicating the palette here would create a
-- second source of truth for the brand colours.
-- =============================================================================

insert into public.departments (slug, name, accent_color, sort_order, is_active)
values
  ('digital-marketing',   'Digital Marketing',   null, 10, true),
  ('electrical-services', 'Electrical Services', null, 20, true),
  ('real-estate',         'Real Estate',         null, 30, true)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Re-run migration 40: Digital Marketing's default store categories.
--
-- Copied from `20260101000040` unchanged apart from this note. The original
-- guard ("the department has no categories") and the `on conflict` clauses make
-- running it twice harmless, and it only inserts when the earlier run found no
-- department to attach to.
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

-- -----------------------------------------------------------------------------
-- Re-run migration 45 (the electrical-services inserts only): solar package
-- categories, products, media, French content and French slugs.
--
-- Copied from `20260101000045` unchanged apart from this note.
-- -----------------------------------------------------------------------------
insert into public.product_categories
  (department_id, slug, name, description, sort_order, is_active, publish_state)
select
  d.id,
  seed.slug,
  seed.name,
  seed.description,
  seed.sort_order,
  true,
  'published'
from public.departments d
cross join (
  values
    ('ess-starter', 'ESS Starter',
     'Budget-friendly all-in-one systems for small homes, shops and kiosks.', 10),
    ('medium-home', 'Medium Home',
     'Inverter, battery and solar systems for average Cameroonian households.', 20),
    ('large-home-business', 'Large Home & Business',
     'For offices, restaurants, schools, churches and growing businesses.', 30),
    ('ultra-large-premium', 'Ultra-Large Premium',
     'For luxury homes, hotels, hospitals, factories and full commercial backup.', 40)
) as seed(slug, name, description, sort_order)
where d.slug = 'electrical-services'
  and not exists (
    select 1 from public.product_categories c
    where c.department_id = d.id and c.slug = 'ess-starter'
  );

insert into public.products (
  category_id, slug, sku, brand, title, short_description, description,
  specifications, price_minor, currency, stock, condition, publish_state, published_at
)
select
  c.id,
  p.slug,
  p.sku,
  'SAKO Power',
  p.title,
  p.short_description,
  p.description,
  p.specifications::jsonb,
  p.price_minor,
  'XAF',
  999,
  'new',
  'draft',
  null
from (
  values
    ('starter-500', 'ess-starter', 'KC-SOLAR-STARTER-500', 'Starter 500',
     'ALPHA all-in-one ESS 500W/1kWh with one 600W solar panel, for small homes and shops.',
     E'Entry-level, budget-friendly all-in-one solar power (ESS and solar panels only) for LED lighting, a TV, phone and laptop charging, a Wi-Fi router and a small fan.\n\nIncludes: SAKO all-in-one ESS 500W/1kWh (built-in inverter and battery); 1x SK-600WD solar panel, 600W, 10-year warranty; mounting, cabling, protection and installation.',
     '[{"label": "Category", "value": "ESS Starter"}, {"label": "Solar panels", "value": "1 x SK-600WD (600W)"}, {"label": "Total package price", "value": "XAF 350,000"}]',
     350000),
    ('starter-1000', 'ess-starter', 'KC-SOLAR-STARTER-1000', 'Starter 1000',
     'ALPHA-I-ESS 1000W/2kWh with two 600W solar panels, for small homes and shops.',
     E'Best-value entry system: the same loads as the Starter 500 plus a small deep-freeze or extra devices.\n\nIncludes: SAKO ALPHA-I-ESS 1000W/2kWh (built-in inverter and battery); 2x SK-600WD solar panels, 600W, 10-year warranty; mounting, cabling, protection and installation.',
     '[{"label": "Category", "value": "ESS Starter"}, {"label": "Solar panels", "value": "2 x SK-600WD (600W)"}, {"label": "Total package price", "value": "XAF 564,000"}]',
     564000),
    ('home-3kva', 'medium-home', 'KC-SOLAR-HOME-3KVA', 'Home 3KVA',
     'E-SUN 3KVA/24V off-grid inverter with battery and panels for average households.',
     E'For lighting, a TV, a fridge, fans, routers and laptops.\n\nIncludes: E-SUN 3KVA/24V off-grid inverter; 2x LI MAX 12.8V/100AH lithium battery (24V bank); 2x SK-600WD solar panel (600W each); mounting, cabling, protection and installation.',
     '[{"label": "Category", "value": "Medium Home"}, {"label": "Solar panels", "value": "2 x SK-600WD (600W)"}, {"label": "Total package price", "value": "XAF 732,000"}]',
     732000),
    ('home-6-2kva', 'medium-home', 'KC-SOLAR-HOME-6-2KVA', 'Home 6.2KVA',
     'E-SUN 6.2KVA BD/48V hybrid inverter with battery and panels.',
     E'Most popular medium system: adds a water pump and more basic home or office equipment.\n\nIncludes: E-SUN 6.2KVA BD/48V hybrid inverter, dual AC output; 1x Li-SUN 51.2V/100AH 5kWh lithium battery; 3x SK-600WD solar panel (600W each); mounting, cabling, protection and installation.',
     '[{"label": "Category", "value": "Medium Home"}, {"label": "Solar panels", "value": "3 x SK-600WD (600W)"}, {"label": "Total package price", "value": "XAF 1,320,000"}]',
     1320000),
    ('home-3kva-standard', 'medium-home', 'KC-SOLAR-HOME-3KVA-STANDARD', 'Home 3KVA Standard',
     'ALPHA-ESS 3KVA/5.12kWh with panels, for average households.',
     E'Adds a water pump, fridge, fans, TV, lighting, laptops and air conditioning.\n\nIncludes: 1x ALPHA-ESS 3KVA/5.12KWH; 4x SK-600WD solar panel (600W each); mounting, cabling, protection and installation.',
     '[{"label": "Category", "value": "Medium Home"}, {"label": "Solar panels", "value": "4 x SK-600WD (600W)"}, {"label": "Total package price", "value": "XAF 1,464,000"}]',
     1464000),
    ('business-10-2kva', 'large-home-business', 'KC-SOLAR-BUSINESS-10-2KVA', 'Business 10.2KVA',
     'E-SUN 10.2KVA BD/48V hybrid inverter with battery and panels, for offices, schools and churches.',
     E'Handles multiple TVs, fridges, a freezer, CCTV, computers and air conditioning.\n\nIncludes: E-SUN 10.2KVA BD/48V hybrid inverter, dual AC output; 1x Li-SUN 51.2V/300AH 15kWh lithium battery; 6x SK-600WD solar panel (600W each); mounting, cabling, protection and installation.',
     '[{"label": "Category", "value": "Large Home & Business"}, {"label": "Solar panels", "value": "6 x SK-600WD (600W)"}, {"label": "Total package price", "value": "XAF 2,538,900"}]',
     2538900),
    ('business-11kva', 'large-home-business', 'KC-SOLAR-BUSINESS-11KVA', 'Business 11KVA',
     'SUNIN 11KVA/48V three-phase hybrid inverter with battery and panels, for churches and hotels.',
     E'For air conditioning, washing machines, water pumps and heavy office loads.\n\nIncludes: SUNPOLO-GN 11KVA/48V hybrid inverter, utility and generator inputs; 1x Li-SUN 51.2V/600AH 30kWh lithium battery; 10x SK-600WD solar panel (600W each); mounting, cabling, protection and installation.',
     '[{"label": "Category", "value": "Large Home & Business"}, {"label": "Solar panels", "value": "10 x SK-600WD (600W)"}, {"label": "Total package price", "value": "XAF 4,329,000"}]',
     4329000),
    ('premium-6kw', 'ultra-large-premium', 'KC-SOLAR-PREMIUM-6KW', 'Premium 6KW',
     'ALPHA-ESS 6KW/10kWh integrated hybrid system with panels.',
     E'Complete home or small commercial backup.\n\nIncludes: SAKO ALPHA-ESS 6KW/10kWh hybrid inverter and battery (integrated); 10x SK-600WD solar panel (600W each); mounting, cabling, protection and installation.',
     '[{"label": "Category", "value": "Ultra-Large Premium"}, {"label": "Solar panels", "value": "10 x SK-600WD (600W)"}, {"label": "Total package price", "value": "XAF 3,120,000"}]',
     3120000),
    ('premium-12kw', 'ultra-large-premium', 'KC-SOLAR-PREMIUM-12KW', 'Premium 12KW 3-Phase',
     'SUNIN 12KW/48V three-phase hybrid inverter with battery and panels.',
     E'For heavy industrial and commercial loads in factories and hospitals.\n\nIncludes: SUNIN 12KW/48V three-phase hybrid inverter, IP67, Wi-Fi; 2x Li-SUN 51.2V/600AH 30kWh lithium battery; 16x SK-600WD solar panel (600W each); mounting, cabling, protection and installation.',
     '[{"label": "Category", "value": "Ultra-Large Premium"}, {"label": "Solar panels", "value": "16 x SK-600WD (600W)"}, {"label": "Total package price", "value": "XAF 9,126,100"}]',
     9126100)
) as p(slug, category_slug, sku, title, short_description, description, specifications, price_minor)
join public.product_categories c
  on c.slug = p.category_slug
join public.departments d
  on d.id = c.department_id and d.slug = 'electrical-services'
where not exists (
  select 1 from public.products existing where existing.sku = p.sku
);

insert into public.product_media
  (product_id, storage_path, alt_text, is_primary, position)
select
  pr.id,
  'electrical/packages/' || pr.slug || '.jpg',
  pr.title || ' — SAKO Power solar package supplied and installed by KC Electrical.',
  true,
  0
from public.products pr
join public.product_categories c on c.id = pr.category_id
join public.departments d on d.id = c.department_id
where d.slug = 'electrical-services'
  and pr.sku like 'KC-SOLAR-%'
  and not exists (
    select 1 from public.product_media m where m.product_id = pr.id
  );

-- Publish only after the media rows exist: `products_publish_requires_media` is a
-- BEFORE INSERT trigger, so a product cannot be inserted already-published even
-- when its media follows in the same migration. It is created as a draft above,
-- given its image here, and published by this update.
update public.products pr
set publish_state = 'published', published_at = now()
from public.product_categories c
join public.departments d on d.id = c.department_id
where pr.category_id = c.id
  and d.slug = 'electrical-services'
  and pr.sku like 'KC-SOLAR-%'
  and pr.publish_state = 'draft'
  and exists (
    select 1 from public.product_media m where m.product_id = pr.id
  );

insert into public.content_translations
  (entity_type, entity_id, field_name, locale, value, state, source_locale, translated_at)
select
  'category', c.id, 'name', 'fr',
  case c.slug
    when 'ess-starter'         then 'ESS Starter'
    when 'medium-home'         then 'Maison moyenne'
    when 'large-home-business' then 'Grande maison et entreprise'
    when 'ultra-large-premium' then 'Très grand format premium'
  end,
  'translated', 'en', now()
from public.product_categories c
join public.departments d on d.id = c.department_id
where d.slug = 'electrical-services'
  and c.slug in ('ess-starter', 'medium-home', 'large-home-business', 'ultra-large-premium')
on conflict (entity_type, entity_id, field_name, locale) do nothing;

insert into public.content_translations
  (entity_type, entity_id, field_name, locale, value, state, source_locale, translated_at)
select
  'product', pr.id, 'name', 'fr', tr.title, 'translated', 'en', now()
from (
  values
    ('KC-SOLAR-STARTER-500',       'Starter 500'),
    ('KC-SOLAR-STARTER-1000',      'Starter 1000'),
    ('KC-SOLAR-HOME-3KVA',         'Maison 3KVA'),
    ('KC-SOLAR-HOME-6-2KVA',       'Maison 6.2KVA'),
    ('KC-SOLAR-HOME-3KVA-STANDARD','Maison 3KVA Standard'),
    ('KC-SOLAR-BUSINESS-10-2KVA',  'Entreprise 10.2KVA'),
    ('KC-SOLAR-BUSINESS-11KVA',    'Entreprise 11KVA'),
    ('KC-SOLAR-PREMIUM-6KW',       'Premium 6KW'),
    ('KC-SOLAR-PREMIUM-12KW',      'Premium 12KW triphasé')
) as tr(sku, title)
join public.products pr on pr.sku = tr.sku
on conflict (entity_type, entity_id, field_name, locale) do nothing;

insert into public.content_translations
  (entity_type, entity_id, field_name, locale, value, state, source_locale, translated_at)
select
  'product', pr.id, 'short_description', 'fr', tr.short_description, 'translated', 'en', now()
from (
  values
    ('KC-SOLAR-STARTER-500',       'ESS tout-en-un ALPHA 500W/1kWh avec un panneau solaire de 600W, pour petits foyers et boutiques.'),
    ('KC-SOLAR-STARTER-1000',      'ALPHA-I-ESS 1000W/2kWh avec deux panneaux solaires de 600W, pour petits foyers et boutiques.'),
    ('KC-SOLAR-HOME-3KVA',         'Onduleur hors réseau E-SUN 3KVA/24V avec batterie et panneaux, pour ménages moyens.'),
    ('KC-SOLAR-HOME-6-2KVA',       'Onduleur hybride E-SUN 6.2KVA BD/48V avec batterie et panneaux.'),
    ('KC-SOLAR-HOME-3KVA-STANDARD','ALPHA-ESS 3KVA/5.12kWh avec panneaux, pour ménages moyens.'),
    ('KC-SOLAR-BUSINESS-10-2KVA',  'Onduleur hybride E-SUN 10.2KVA BD/48V avec batterie et panneaux, pour bureaux, écoles et églises.'),
    ('KC-SOLAR-BUSINESS-11KVA',    'Onduleur hybride triphasé SUNIN 11KVA/48V avec batterie et panneaux, pour églises et hôtels.'),
    ('KC-SOLAR-PREMIUM-6KW',       'Système hybride intégré ALPHA-ESS 6KW/10kWh avec panneaux.'),
    ('KC-SOLAR-PREMIUM-12KW',      'Onduleur hybride triphasé SUNIN 12KW/48V avec batterie et panneaux.')
) as tr(sku, short_description)
join public.products pr on pr.sku = tr.sku
on conflict (entity_type, entity_id, field_name, locale) do nothing;

insert into public.content_translations
  (entity_type, entity_id, field_name, locale, value, state, source_locale, translated_at)
select
  'product', pr.id, 'description', 'fr', tr.description, 'translated', 'en', now()
from (
  values
    ('KC-SOLAR-STARTER-500', E'ESS tout-en-un abordable (ESS et panneaux solaires uniquement) pour l''éclairage LED, une télévision, la charge de téléphones et d''ordinateurs portables, un routeur Wi-Fi et un petit ventilateur.\n\nComprend : ESS tout-en-un SAKO 500W/1kWh (onduleur et batterie intégrés) ; 1 x panneau solaire SK-600WD, 600W, garantie 10 ans ; fixation, câblage, protection et installation.'),
    ('KC-SOLAR-STARTER-1000', E'Système d''entrée de gamme au meilleur rapport qualité-prix : les mêmes charges que le Starter 500 plus un petit congélateur ou des appareils supplémentaires.\n\nComprend : SAKO ALPHA-I-ESS 1000W/2kWh (onduleur et batterie intégrés) ; 2 x panneaux solaires SK-600WD, 600W, garantie 10 ans ; fixation, câblage, protection et installation.'),
    ('KC-SOLAR-HOME-3KVA', E'Pour l''éclairage, une télévision, un réfrigérateur, des ventilateurs, des routeurs et des ordinateurs portables.\n\nComprend : onduleur hors réseau E-SUN 3KVA/24V ; 2 x batteries au lithium LI MAX 12,8V/100AH (banc 24V) ; 2 x panneaux solaires SK-600WD (600W chacun) ; fixation, câblage, protection et installation.'),
    ('KC-SOLAR-HOME-6-2KVA', E'Le système moyen le plus demandé : ajoute une pompe à eau et davantage d''équipements domestiques ou de bureau.\n\nComprend : onduleur hybride E-SUN 6.2KVA BD/48V, double sortie CA ; 1 x batterie au lithium Li-SUN 51,2V/100AH 5kWh ; 3 x panneaux solaires SK-600WD (600W chacun) ; fixation, câblage, protection et installation.'),
    ('KC-SOLAR-HOME-3KVA-STANDARD', E'Ajoute une pompe à eau, un réfrigérateur, des ventilateurs, une télévision, l''éclairage, des ordinateurs portables et la climatisation.\n\nComprend : 1 x ALPHA-ESS 3KVA/5.12KWH ; 4 x panneaux solaires SK-600WD (600W chacun) ; fixation, câblage, protection et installation.'),
    ('KC-SOLAR-BUSINESS-10-2KVA', E'Gère plusieurs téléviseurs, réfrigérateurs, un congélateur, la vidéosurveillance, des ordinateurs et la climatisation.\n\nComprend : onduleur hybride E-SUN 10.2KVA BD/48V, double sortie CA ; 1 x batterie au lithium Li-SUN 51,2V/300AH 15kWh ; 6 x panneaux solaires SK-600WD (600W chacun) ; fixation, câblage, protection et installation.'),
    ('KC-SOLAR-BUSINESS-11KVA', E'Pour la climatisation, les machines à laver, les pompes à eau et les charges de bureau lourdes.\n\nComprend : onduleur hybride SUNPOLO-GN 11KVA/48V, entrées réseau et groupe électrogène ; 1 x batterie au lithium Li-SUN 51,2V/600AH 30kWh ; 10 x panneaux solaires SK-600WD (600W chacun) ; fixation, câblage, protection et installation.'),
    ('KC-SOLAR-PREMIUM-6KW', E'Sauvegarde complète pour une maison ou un petit commerce.\n\nComprend : onduleur hybride et batterie SAKO ALPHA-ESS 6KW/10kWh (intégrés) ; 10 x panneaux solaires SK-600WD (600W chacun) ; fixation, câblage, protection et installation.'),
    ('KC-SOLAR-PREMIUM-12KW', E'Pour les charges industrielles et commerciales lourdes des usines et des hôpitaux.\n\nComprend : onduleur hybride triphasé SUNIN 12KW/48V, IP67, Wi-Fi ; 2 x batteries au lithium Li-SUN 51,2V/600AH 30kWh ; 16 x panneaux solaires SK-600WD (600W chacun) ; fixation, câblage, protection et installation.')
) as tr(sku, description)
join public.products pr on pr.sku = tr.sku
on conflict (entity_type, entity_id, field_name, locale) do nothing;

insert into public.product_slugs (product_id, locale, slug)
select pr.id, 'fr', tr.slug
from (
  values
    ('KC-SOLAR-STARTER-500',       'kit-starter-500'),
    ('KC-SOLAR-STARTER-1000',      'kit-starter-1000'),
    ('KC-SOLAR-HOME-3KVA',         'kit-maison-3kva'),
    ('KC-SOLAR-HOME-6-2KVA',       'kit-maison-6-2kva'),
    ('KC-SOLAR-HOME-3KVA-STANDARD','kit-maison-3kva-standard'),
    ('KC-SOLAR-BUSINESS-10-2KVA',  'kit-entreprise-10-2kva'),
    ('KC-SOLAR-BUSINESS-11KVA',    'kit-entreprise-11kva'),
    ('KC-SOLAR-PREMIUM-6KW',       'kit-premium-6kw'),
    ('KC-SOLAR-PREMIUM-12KW',      'kit-premium-12kw')
) as tr(sku, slug)
join public.products pr on pr.sku = tr.sku
on conflict (product_id, locale) do nothing;
