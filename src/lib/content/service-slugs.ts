/**
 * The nine Digital Marketing service areas, in display order.
 *
 * Slug order here is the order the catalogue renders in, and it is also what the
 * sitemap and the route `generateStaticParams` iterate. Kept in its own module so
 * a route can enumerate slugs without importing the service content itself.
 */
export const SERVICE_SLUGS = [
  "social-media-marketing",
  "website-design-development",
  "seo",
  "google-online-ads",
  "content-branding",
  "ecommerce-store-development",
  "training-consulting",
  "influencer-affiliate-marketing",
  "online-business-setup-automation",
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

/**
 * The nine Electrical Services areas, in the order the business brief lists them.
 *
 * Kept separate from `SERVICE_SLUGS` rather than merged into one list: the two
 * departments have no slugs in common, and a single list would let a Digital
 * Marketing slug be resolved under the Electrical Services route (and vice
 * versa) by any code that validated against the union.
 */
export const ELECTRICAL_SERVICE_SLUGS = [
  "electrical-installation",
  "solar-energy-systems",
  "maintenance-repairs",
  "smart-home-automation",
  "cctv-security",
  "equipment-supply-sales",
  "safety-inspections",
  "industrial-project-contracting",
  "low-medium-voltage-line-design-construction",
] as const;

export type ElectricalServiceSlug = (typeof ELECTRICAL_SERVICE_SLUGS)[number];

export function isServiceSlug(value: string): value is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(value);
}

export function isElectricalServiceSlug(
  value: string,
): value is ElectricalServiceSlug {
  return (ELECTRICAL_SERVICE_SLUGS as readonly string[]).includes(value);
}
