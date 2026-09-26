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

export function isServiceSlug(value: string): value is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(value);
}
