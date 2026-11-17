import "server-only";

import { getAuthState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import type { DashboardKind } from "./dashboard";
import { loadMyMembershipSummary } from "./membership-loaders";
import type { MembershipSummary } from "./memberships";

/**
 * Reads for the landlord and agent dashboards.
 *
 * Every read goes through the cookie-bound session client, never the service-role
 * client. The policies added by `20260101000058_listing_ownership.sql` scope a
 * landlord to the listings they own and a manager to what they manage, so the
 * database decides what a dashboard can show. A loader that used the admin client
 * would move that decision into TypeScript and make the policies decorative — the
 * same mistake the favourites surface documents.
 *
 * The loaders do not add an ownership filter of their own for the same reason:
 * `owner_id = auth.uid()` here would be a second, weaker copy of the policy. Where
 * a filter *is* needed it is because the page needs a subset (drafts, say), not
 * because the loader is the control.
 *
 * On any failure each loader returns an empty result, so a database outage renders
 * "nothing yet" rather than an error page.
 */

/** A listing as a dashboard lists it. */
export type DashboardListing = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  source: string;
  listingType: string;
  propertyKind: string;
  propertyType: string;
  locality: string | null;
  regionId: string | null;
  divisionId: string | null;
  subdivisionId: string | null;
  regionName: string | null;
  highlights: readonly string[];
  amenities: readonly string[];
  priceMinor: number | null;
  currency: string;
  pricePeriod: string;
  priceOnRequest: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: number | null;
  buildingAreaSqm: number | null;
  landAreaSqm: number | null;
  viewCount: number;
  inquiryCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** The moderation decision on this listing's submission, when there is one. */
  submission: { status: string; reviewNotes: string | null } | null;
};

/** The columns every dashboard listing read projects. */
const DASHBOARD_LISTING_SELECT =
  "id, reference, slug, title, description, status, source, listing_type, property_kind, property_type, locality, region_id, division_id, subdivision_id, highlights, amenities, price_minor, currency, price_period, price_on_request, bedrooms, bathrooms, year_built, building_area_sqm, land_area_sqm, view_count, inquiry_count, published_at, created_at, updated_at, regions (name, name_fr), listing_submissions (status, review_notes)";

type ListingRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/**
 * Map a listing row to the dashboard shape.
 *
 * `listing_submissions` is a to-many embed, so PostgREST returns an array. The
 * schema does not forbid two submissions for one listing, so the most recent is
 * taken — which is the one whose decision is current. An array is handled rather
 * than assumed away because a second submission is a legitimate future state
 * (the reviewer sends the first back and the owner answers).
 */
function toDashboardListing(row: ListingRow): DashboardListing {
  const region = row.regions as { name?: unknown; name_fr?: unknown } | null;
  const submissions = row.listing_submissions as
    | { status?: unknown; review_notes?: unknown }[]
    | null;

  const latest = Array.isArray(submissions) && submissions.length > 0
    ? submissions[submissions.length - 1]
    : null;

  return {
    id: String(row.id),
    reference: asString(row.reference) ?? "",
    slug: asString(row.slug) ?? "",
    title: asString(row.title) ?? "",
    description: asString(row.description) ?? "",
    status: asString(row.status) ?? "draft",
    source: asString(row.source) ?? "",
    listingType: asString(row.listing_type) ?? "",
    propertyKind: asString(row.property_kind) ?? "",
    propertyType: asString(row.property_type) ?? "residential",
    locality: asString(row.locality),
    regionId: asString(row.region_id),
    divisionId: asString(row.division_id),
    subdivisionId: asString(row.subdivision_id),
    regionName: asString(region?.name),
    highlights: asStringArray(row.highlights),
    amenities: asStringArray(row.amenities),
    priceMinor: asNumber(row.price_minor),
    currency: asString(row.currency) ?? "XAF",
    pricePeriod: asString(row.price_period) ?? "total",
    priceOnRequest: row.price_on_request === true,
    bedrooms: asNumber(row.bedrooms),
    bathrooms: asNumber(row.bathrooms),
    yearBuilt: asNumber(row.year_built),
    buildingAreaSqm: asNumber(row.building_area_sqm),
    landAreaSqm: asNumber(row.land_area_sqm),
    viewCount: asNumber(row.view_count) ?? 0,
    inquiryCount: asNumber(row.inquiry_count) ?? 0,
    publishedAt: asString(row.published_at),
    createdAt: asString(row.created_at) ?? "",
    updatedAt: asString(row.updated_at) ?? "",
    submission:
      latest && typeof latest.status === "string"
        ? {
            status: latest.status,
            reviewNotes: asString(latest.review_notes),
          }
        : null,
  };
}

/**
 * The listings a dashboard shows.
 *
 * Scoped by RLS, not by this query: a landlord's session reaches the rows they
 * own and a manager's reaches what they manage. The order is newest-activity
 * first, which is the order a user works a portfolio in.
 */
export async function loadDashboardListings(): Promise<DashboardListing[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("property_listings")
      .select(DASHBOARD_LISTING_SELECT)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error || !data) return [];
    return data.map((row) => toDashboardListing(row as ListingRow));
  } catch {
    return [];
  }
}

/** One listing for the edit form, or null when the caller may not see it. */
export async function loadDashboardListingById(
  id: string,
): Promise<DashboardListing | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from("property_listings")
      .select(DASHBOARD_LISTING_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (!data) return null;
    return toDashboardListing(data as ListingRow);
  } catch {
    return null;
  }
}

/** A listing's own photographs, for the dashboard media panel. */
export type DashboardMedia = {
  id: string;
  storagePath: string;
  altText: string;
  position: number;
  isPrimary: boolean;
};

export async function loadDashboardListingMedia(
  listingId: string,
): Promise<DashboardMedia[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("listing_media")
      .select("id, storage_path, alt_text, position, is_primary")
      .eq("listing_id", listingId)
      .order("position", { ascending: true });

    return (data ?? []).map((row) => ({
      id: row.id,
      storagePath: row.storage_path,
      altText: row.alt_text,
      position: row.position,
      isPrimary: row.is_primary,
    }));
  } catch {
    return [];
  }
}

/**
 * An agent's own business record.
 *
 * Resolved by `user_id`, which is unique on the table, so this returns the one row
 * the account owns. The `agent_profiles_update_own` policy already restricts the
 * write to that row; this read is scoped the same way so the dashboard cannot be
 * shown another agent's record.
 */
export type DashboardAgentProfile = {
  id: string;
  displayName: string;
  slug: string;
  title: string | null;
  bio: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  licenseNumber: string | null;
  regionId: string | null;
  serviceAreas: readonly string[];
  isActive: boolean;
};

export async function loadMyAgentProfile(): Promise<DashboardAgentProfile | null> {
  try {
    const auth = await getAuthState();
    if (auth.status !== "authenticated") return null;

    const supabase = await createClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from("agent_profiles")
      .select(
        "id, display_name, slug, title, bio, public_email, public_phone, license_number, region_id, service_areas, is_active",
      )
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      displayName: data.display_name,
      slug: data.slug,
      title: data.title,
      bio: data.bio,
      publicEmail: data.public_email,
      publicPhone: data.public_phone,
      licenseNumber: data.license_number,
      regionId: data.region_id,
      serviceAreas: data.service_areas ?? [],
      isActive: data.is_active,
    };
  } catch {
    return null;
  }
}

/**
 * Everything a dashboard page needs to decide what to render.
 *
 * Bundled into one loader so the page makes a single decision rather than
 * interleaving four reads with the authorization logic — and so the guard and the
 * content are derived from the same snapshot.
 */
export type DashboardContext = {
  kind: DashboardKind;
  /** True when the caller holds the approved capability for this dashboard. */
  authorised: boolean;
  /** The capability's summary, for the verification panel when not approved. */
  membership: MembershipSummary;
  listings: readonly DashboardListing[];
  agentProfile: DashboardAgentProfile | null;
};

export async function loadDashboardContext(
  kind: DashboardKind,
): Promise<DashboardContext | null> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated") return null;

  const memberships = await loadMyMembershipSummary();
  const membership = memberships.find((entry) => entry.type === kind);
  if (!membership) return null;

  // A caller without the capability gets the verification panel, so the listings
  // and the agent record are not read at all — there is nothing to show and the
  // policies would refuse most of it anyway.
  if (!membership.isActive) {
    return {
      kind,
      authorised: false,
      membership,
      listings: [],
      agentProfile: null,
    };
  }

  const [listings, agentProfile] = await Promise.all([
    loadDashboardListings(),
    kind === "agent" ? loadMyAgentProfile() : Promise.resolve(null),
  ]);

  return { kind, authorised: true, membership, listings, agentProfile };
}
