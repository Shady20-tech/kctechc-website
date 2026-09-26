import { serializeJsonLd, type JsonLd } from "@/lib/seo/structured-data";

/**
 * Renders structured data as JSON-LD.
 *
 * The payload is serialized server-side and `<` is escaped by
 * `serializeJsonLd`, so a content value can never break out of the script tag.
 */
export function JsonLdScript({ data }: { data: JsonLd }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
