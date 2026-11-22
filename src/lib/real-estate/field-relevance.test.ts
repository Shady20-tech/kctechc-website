import { describe, expect, it } from "vitest";

import { LISTING_PROPERTY_KINDS } from "./enums";
import {
  asListingPropertyKind,
  fieldRelevanceFor,
  shouldRenderField,
} from "./field-relevance";

describe("fieldRelevanceFor", () => {
  it("hides rooms, building area and year built for land", () => {
    const r = fieldRelevanceFor("land");
    expect(r.rooms).toBe(false);
    expect(r.buildingArea).toBe(false);
    expect(r.yearBuilt).toBe(false);
    // A plot's size is its defining fact, so it stays.
    expect(r.landArea).toBe(true);
  });

  it("treats farm as land", () => {
    const r = fieldRelevanceFor("farm");
    expect(r.rooms).toBe(false);
    expect(r.buildingArea).toBe(false);
    expect(r.landArea).toBe(true);
  });

  it("shows rooms for every kind people live in", () => {
    for (const kind of [
      "house",
      "apartment",
      "villa",
      "duplex",
      "studio",
      "bungalow",
      "guesthouse",
    ] as const) {
      expect(fieldRelevanceFor(kind).rooms, kind).toBe(true);
    }
  });

  it("hides rooms for a warehouse but keeps building area", () => {
    const r = fieldRelevanceFor("warehouse");
    expect(r.rooms).toBe(false);
    expect(r.buildingArea).toBe(true);
  });

  it("keeps coordinates available for every kind", () => {
    // The whole point of the change: coordinates are never forced, but they are
    // never removed either, because a surveyed plot may have them.
    for (const kind of LISTING_PROPERTY_KINDS) {
      expect(fieldRelevanceFor(kind).coordinates, kind).toBe(true);
    }
  });

  it("shows everything for an unknown or empty kind", () => {
    const r = fieldRelevanceFor("");
    expect(r).toEqual({
      rooms: true,
      buildingArea: true,
      landArea: true,
      yearBuilt: true,
      coordinates: true,
    });
  });
});

describe("shouldRenderField", () => {
  it("renders a relevant field even when empty", () => {
    expect(shouldRenderField(true, null)).toBe(true);
    expect(shouldRenderField(true, "")).toBe(true);
  });

  it("hides an irrelevant field that has no value", () => {
    expect(shouldRenderField(false, null)).toBe(false);
    expect(shouldRenderField(false, undefined)).toBe(false);
    expect(shouldRenderField(false, "")).toBe(false);
    expect(shouldRenderField(false, "   ")).toBe(false);
  });

  it("keeps an irrelevant field visible when it already holds a value", () => {
    // Otherwise a landlord who switches a house to land could neither see nor
    // clear the bedrooms they entered, and the next save would drop them.
    expect(shouldRenderField(false, 3)).toBe(true);
    expect(shouldRenderField(false, "1998")).toBe(true);
  });

  it("treats zero as a real value", () => {
    expect(shouldRenderField(false, 0)).toBe(true);
  });
});

describe("asListingPropertyKind", () => {
  it("passes a known kind through", () => {
    expect(asListingPropertyKind("land")).toBe("land");
    expect(asListingPropertyKind("apartment")).toBe("apartment");
  });

  it("maps an unknown or missing value to empty so all fields show", () => {
    expect(asListingPropertyKind("")).toBe("");
    expect(asListingPropertyKind(null)).toBe("");
    expect(asListingPropertyKind(undefined)).toBe("");
    expect(asListingPropertyKind("castle")).toBe("");
  });
});
