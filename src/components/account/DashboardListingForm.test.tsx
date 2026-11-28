import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardListingForm } from "@/components/account/DashboardListingForm";
import type { DashboardListing } from "@/lib/real-estate/dashboard-loaders";

/**
 * The listing form must only ask for characteristics that apply to the property.
 *
 * The rule itself is unit-tested in `field-relevance.test.ts`; these assertions
 * cover the wiring, because the failure mode is a form that computes relevance
 * and then renders every field anyway.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/account/landlord",
}));

const geography = [
  {
    id: "region-1",
    name: "Southwest",
    code: "SW",
    divisions: [],
  },
] as const;

function renderForm(listing?: DashboardListing) {
  return render(
    <DashboardListingForm
      kind="landlord"
      locale="en"
      geography={geography}
      listing={listing}
    />,
  );
}

function listingFixture(
  over: Partial<DashboardListing> = {},
): DashboardListing {
  return {
    id: "listing-1",
    reference: "KC-RE-000001",
    slug: "test-listing",
    title: "Test listing",
    description: "A description that is long enough to satisfy the schema.",
    status: "draft",
    source: "owner_submission",
    listingType: "sale",
    propertyKind: "house",
    propertyType: "residential",
    locality: null,
    regionId: "region-1",
    divisionId: null,
    subdivisionId: null,
    regionName: "Southwest",
    highlights: [],
    amenities: [],
    priceMinor: 12_000_000,
    currency: "XAF",
    pricePeriod: "total",
    priceOnRequest: false,
    bedrooms: null,
    bathrooms: null,
    yearBuilt: null,
    buildingAreaSqm: null,
    landAreaSqm: null,
    viewCount: 0,
    inquiryCount: 0,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    submission: null,
    ...over,
  };
}

describe("DashboardListingForm field relevance", () => {
  it("shows rooms and building area for a house", () => {
    renderForm();
    expect(screen.getByLabelText(/Bedrooms/i)).toBeTruthy();
    expect(screen.getByLabelText(/Bathrooms/i)).toBeTruthy();
    expect(screen.getByLabelText(/Building area/i)).toBeTruthy();
    expect(screen.getByLabelText(/Year built/i)).toBeTruthy();
  });

  it("hides rooms, building area and year built once land is chosen", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Property kind/i), {
      target: { value: "land" },
    });

    expect(screen.queryByLabelText(/Bedrooms/i)).toBeNull();
    expect(screen.queryByLabelText(/Bathrooms/i)).toBeNull();
    expect(screen.queryByLabelText(/Building area/i)).toBeNull();
    expect(screen.queryByLabelText(/Year built/i)).toBeNull();
    // A plot's own size is the one characteristic that still applies.
    expect(screen.getByLabelText(/Land area/i)).toBeTruthy();
  });

  it("keeps a stored value visible even when its field stops applying", () => {
    // Otherwise switching a house to land would hide the bedrooms the owner
    // already entered, leaving no way to see or clear them.
    renderForm(listingFixture({ propertyKind: "land", bedrooms: 3 }));
    expect(screen.getByLabelText(/Bedrooms/i)).toBeTruthy();
  });

  it("never removes the coordinates fields, whatever the kind", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Property kind/i), {
      target: { value: "land" },
    });
    expect(screen.getByLabelText(/^Longitude$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Latitude$/i)).toBeTruthy();
  });

  it("offers create-time photographs and a draft-or-review choice", () => {
    renderForm();
    expect(screen.getByLabelText(/Property photographs/i)).toBeTruthy();
    expect(screen.getByLabelText(/What happens next/i)).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /Submit for review/i }),
    ).toBeTruthy();
  });

  it("does not ask for a slug or a free-text locality on create", () => {
    renderForm();
    expect(screen.queryByLabelText(/URL slug/i)).toBeNull();
    expect(screen.queryByLabelText(/Locality/i)).toBeNull();
    expect(screen.getByLabelText(/^Region/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Division/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Subdivision/i)).toBeTruthy();
  });

  it("keeps the slug editable when editing an existing listing", () => {
    renderForm(listingFixture());
    expect(screen.getByLabelText(/URL slug/i)).toBeTruthy();
  });

  it("hides the create-only upload and review choice when editing", () => {
    renderForm(listingFixture());
    expect(screen.queryByLabelText(/Property photographs/i)).toBeNull();
    expect(screen.queryByLabelText(/What happens next/i)).toBeNull();
  });

  it("tells the owner the optional fields can be left empty", () => {
    renderForm();
    expect(
      screen.getAllByText(/Only the fields that apply/i).length,
    ).toBeGreaterThan(0);
  });
});
