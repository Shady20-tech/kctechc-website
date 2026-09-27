import type { Locale } from "@/lib/i18n/locales";

import type {
  ListingPropertyKind,
  ListingSource,
  ListingStatus,
  ListingType,
  PricePeriod,
  PropertyType,
  SubmissionStatus,
} from "./enums";

/**
 * Real-estate content contracts.
 *
 * The same shape is produced whether a listing came from Supabase or from a test
 * fixture, following the convention established by the store and service layers:
 * a page renders through one code path regardless of the source.
 *
 * The split between `PropertyListingRecord` and `ListingPrivateDetails` is
 * deliberate and is the type-level expression of the database's separation.
 * A public loader returns the record; only an admin or the owning agent can
 * obtain the private details, because the private table has no anonymous policy.
 * Keeping them as two types means a component that renders a public card cannot
 * even name the private fields.
 */

export type ListingImage = {
  id: string;
  storagePath: string;
  alt: string;
  caption?: string;
  isPrimary: boolean;
  position: number;
  width?: number;
  height?: number;
};

export type ListingSeo = {
  title?: string;
  description?: string;
  canonicalOverride?: string;
  ogImagePath?: string;
  noindex?: boolean;
};

/** A localized overlay for one locale. */
export type ListingOverlay = Partial<{
  title: string;
  description: string;
  highlights: readonly string[];
}>;

/**
 * The listing fields a visitor may see.
 *
 * Notably absent: any address, coordinate or owner contact. The public location
 * is a separate, already-coarsened value (`publicLocation`), which is why a
 * public card has no way to reach the exact position.
 */
export type PropertyListingRecord = {
  id: string;
  reference: string;
  /** Canonical (source-locale) slug. */
  slug: string;
  listingType: ListingType;
  propertyKind: ListingPropertyKind;
  propertyType: PropertyType;
  status: ListingStatus;
  source: ListingSource;

  regionSlug: string;
  regionName: string;

  locality?: string;

  title: string;
  description: string;
  highlights: readonly string[];
  amenities: readonly string[];

  priceMinor: number | null;
  currency: string;
  pricePeriod: PricePeriod;
  priceOnRequest: boolean;

  landAreaSqm?: number;
  buildingAreaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;

  images: readonly ListingImage[];

  isFeatured: boolean;
  viewCount: number;
  inquiryCount: number;

  publishedAt?: string;
  closedAt?: string;
  listedOn?: string;

  agentId?: string;
  agentName?: string;

  /** The coarsened position, safe to publish. Never the exact one. */
  publicLocation?: { longitude: number; latitude: number; precisionMetres: number };

  localizedSlugs?: Partial<Record<Locale, string>>;
  translations?: Partial<Record<Locale, ListingOverlay>>;
  seo?: ListingSeo;

  createdAt: string;
  updatedAt: string;
};

/**
 * Sensitive listing data. Only an administrator or the owning agent receives
 * this; the public surface never does, because the table it comes from has no
 * anonymous policy.
 */
export type ListingPrivateDetails = {
  listingId: string;
  exactAddress?: string;
  exactLongitude?: number;
  exactLatitude?: number;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerNotes?: string;
  internalNotes?: string;
  updatedAt: string;
};

/** A listing as the admin surface needs it: the public record plus the flags. */
export type AdminListingRecord = PropertyListingRecord & {
  regionId: string | null;
  divisionId: string | null;
  subdivisionId: string | null;
  hasExactLocation: boolean;
  hasOwnerContact: boolean;
  /** Set when an owner submission is awaiting or has had a decision. */
  submissionStatus: SubmissionStatus | null;
  submissionId: string | null;
};

export type ListingSubmissionRecord = {
  id: string;
  listingId: string;
  listingReference: string;
  listingTitle: string;
  listingSlug: string;
  status: SubmissionStatus;
  submitterName: string;
  submitterEmail?: string;
  submitterPhone?: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
};

export type AgentRecord = {
  id: string;
  displayName: string;
  slug: string;
  title?: string;
  bio?: string;
  publicEmail?: string;
  publicPhone?: string;
  photoPath?: string;
  licenseNumber?: string;
  regionId?: string;
  regionName?: string;
  serviceAreas: readonly string[];
  isActive: boolean;
  userId?: string;
  listingCount: number;
  createdAt: string;
};

/** The counts shown on the admin dashboard, read in one pass. */
export type RealEstateOverview = {
  total: number;
  drafts: number;
  pendingReview: number;
  published: number;
  archived: number;
  pendingSubmissions: number;
  activeAgents: number;
};
