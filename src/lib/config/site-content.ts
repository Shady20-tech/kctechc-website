import "server-only";

import { SITE } from "@/lib/config/site";
import { createClient } from "@/lib/supabase/server";

/**
 * Editable site settings.
 *
 * Header and footer content is read from the `site_settings` table so it can be
 * changed without a deploy, but the values supplied by the business brief in
 * `SITE` remain the fallback. That ordering matters: if Supabase is
 * unconfigured or unreachable the site still renders the correct corporate
 * details rather than empty fields, and an editor can never accidentally erase
 * the phone number by clearing a row.
 *
 * Reads are anonymous against RLS (`is_public = true`), so this is safe on the
 * public render path and never touches the service-role key.
 */

export type ContactDetails = {
  email: string;
  phones: readonly string[];
  address: {
    street: string;
    city: string;
    region: string;
    country: string;
  };
};

export type SiteContent = {
  legalName: string;
  shortName: string;
  motto: string;
  contact: ContactDetails;
};

export const FALLBACK_SITE_CONTENT: SiteContent = {
  legalName: SITE.legalName,
  shortName: SITE.shortName,
  motto: SITE.motto,
  contact: {
    email: SITE.email,
    phones: SITE.phones,
    address: SITE.address,
  },
};

/** Narrow an unknown JSON value to a non-empty string. */
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(asString).filter((item): item is string => item !== null);
  return items.length > 0 ? items : null;
}

function asAddress(value: unknown): ContactDetails["address"] | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const street = asString(record.street);
  const city = asString(record.city);
  const region = asString(record.region);
  const country = asString(record.country);
  if (!street || !city || !region || !country) return null;
  return { street, city, region, country };
}

/**
 * Load public site settings, falling back to the brief's values for anything
 * absent or malformed. Never throws: a settings outage must not take the site
 * down.
 */
export async function getSiteContent(): Promise<SiteContent> {
  let content: SiteContent = FALLBACK_SITE_CONTENT;

  try {
    const supabase = await createClient();
    if (!supabase) return content;

    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["site.motto", "site.contact"]);

    if (error || !data) return content;

    for (const row of data) {
      if (row.key === "site.motto") {
        const motto = asString(row.value);
        if (motto) content = { ...content, motto };
      }

      if (row.key === "site.contact") {
        if (typeof row.value !== "object" || row.value === null) continue;
        const record = row.value as Record<string, unknown>;
        content = {
          ...content,
          contact: {
            email: asString(record.email) ?? content.contact.email,
            phones: asStringArray(record.phones) ?? content.contact.phones,
            address: asAddress(record.address) ?? content.contact.address,
          },
        };
      }
    }
  } catch {
    // Fall through with the brief's values.
  }

  return content;
}
