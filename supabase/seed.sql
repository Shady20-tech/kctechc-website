-- =============================================================================
-- Development seed data.
--
-- IMPORTANT: Everything here is DEVELOPMENT SEED DATA. It is not a production
-- marketing claim and must not be presented as verified business fact.
--
-- The ten Regions below are the only administrative level supplied by the
-- business brief. Divisions and subdivisions are intentionally NOT seeded:
-- they are loaded from a vetted dataset via
-- public.import_administrative_divisions().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The three corporate departments (slugs are stable across locales).
-- -----------------------------------------------------------------------------
insert into public.departments (slug, name, accent_color, sort_order, is_active)
values
  ('digital-marketing', 'Digital Marketing', '#2E6FB8', 10, true),
  ('electrical-services', 'Electrical Services', '#D98E04', 20, true),
  ('real-estate', 'Real Estate', '#1E7A5C', 30, true)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- The ten Regions of Cameroon (business brief).
-- -----------------------------------------------------------------------------
insert into public.regions (code, name, name_fr, slug, sort_order)
values
  ('AD',  'Adamawa',   'Adamaoua',    'adamawa',    10),
  ('CE',  'Centre',    'Centre',      'centre',     20),
  ('ES',  'East',      'Est',         'east',       30),
  ('EN',  'Far North', 'Extrême-Nord','far-north',  40),
  ('LT',  'Littoral',  'Littoral',    'littoral',   50),
  ('NO',  'North',     'Nord',        'north',      60),
  ('NW',  'Northwest', 'Nord-Ouest',  'northwest',  70),
  ('OU',  'West',      'Ouest',       'west',       80),
  ('SU',  'South',     'Sud',         'south',      90),
  ('SW',  'Southwest', 'Sud-Ouest',   'southwest', 100)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Public site settings — editable content, not hardcoded facts.
-- `is_public = true` so the anonymous render path may read them.
-- -----------------------------------------------------------------------------
insert into public.site_settings (key, value, description, is_public)
values
  (
    'site.motto',
    to_jsonb('Innovating Technology. Powering Infrastructure. Transforming Futures.'::text),
    'Corporate motto displayed in the header and footer.',
    true
  ),
  (
    'site.contact',
    jsonb_build_object(
      'email', 'kctechc@gmail.com',
      'phones', jsonb_build_array('+237 679-202-265', '656-218-651'),
      'address', jsonb_build_object(
        'street', 'Half-Mile',
        'city', 'Limbe',
        'region', 'Southwest Region',
        'country', 'Cameroon'
      )
    ),
    'Public contact details. Values mirror the business brief.',
    true
  ),
  (
    'payments.enabled',
    to_jsonb(false),
    'Payment provider feature flag. Stays false until production credentials exist.',
    false
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- French translations for the seeded departments.
--
-- Only department labels are seeded because these are the names the brief
-- supplies. They are marked `translated` so the localized site renders. Product,
-- service and property translations are created by the publishing workflow.
-- -----------------------------------------------------------------------------
insert into public.content_translations
  (entity_type, entity_id, field_name, locale, value, state, source_locale, translated_at)
select
  'department',
  d.id,
  'name',
  'fr',
  case d.slug
    when 'digital-marketing' then 'Marketing digital'
    when 'electrical-services' then 'Services électriques'
    when 'real-estate' then 'Immobilier'
  end,
  'translated',
  'en',
  now()
from public.departments d
where d.slug in ('digital-marketing', 'electrical-services', 'real-estate')
on conflict (entity_type, entity_id, field_name, locale) do nothing;
