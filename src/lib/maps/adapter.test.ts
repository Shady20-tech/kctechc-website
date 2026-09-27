import { describe, expect, it } from "vitest";

import {
  CAMEROON_BOUNDS,
  CAMEROON_VIEW,
  activeMapProvider,
  drawablePoints,
  isMapProvider,
  isWithinCameroon,
  mapStyleFor,
  toFeatureCollection,
  viewForPoints,
  zoomForSpan,
  type MapPoint,
} from "./adapter";

/**
 * Tests for the map adapter.
 *
 * The behaviour worth pinning here is the failure behaviour, not the happy path:
 * what happens when a coordinate is outside Cameroon, when a provider has no
 * token, and when a single point must be framed. Those are the cases that decide
 * whether a visitor sees a wrong marker or an empty canvas, and none of them can
 * be checked by looking at a correctly configured map.
 */

const point = (overrides: Partial<MapPoint> = {}): MapPoint => ({
  id: "listing-1",
  label: "KC-RE-000001",
  longitude: 9.7,
  latitude: 4.05,
  ...overrides,
});

describe("isMapProvider", () => {
  it("accepts the known providers", () => {
    expect(isMapProvider("openfreemap")).toBe(true);
    expect(isMapProvider("mapbox")).toBe(true);
    expect(isMapProvider("google")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isMapProvider("leaflet")).toBe(false);
    expect(isMapProvider("")).toBe(false);
  });
});

describe("activeMapProvider", () => {
  it("defaults to OpenFreeMap when the environment is unset", () => {
    // The MAP_PROVIDER variable is absent in this test environment, which is the
    // same state as a fresh checkout.
    expect(activeMapProvider()).toBe("openfreemap");
  });
});

describe("mapStyleFor", () => {
  it("gives OpenFreeMap a keyless style URL", () => {
    const style = mapStyleFor("openfreemap");
    expect(style.unavailable).toBe(false);
    expect(style.styleUrl).toContain("openfreemap.org");
    expect(style.requiresAttribution).toBe(true);
  });

  it("reports Mapbox unavailable without a token rather than substituting", () => {
    // A deployment that believes it is using Mapbox while showing OpenFreeMap
    // tiles is a licensing problem; failing visibly is the correct behaviour.
    const style = mapStyleFor("mapbox");
    expect(style.unavailable).toBe(true);
    expect(style.styleUrl).toBe("");
  });

  it("reports Google unavailable, since MapLibre cannot consume it by style URL", () => {
    expect(mapStyleFor("google").unavailable).toBe(true);
  });
});

describe("isWithinCameroon", () => {
  it("accepts a point inside the country", () => {
    expect(isWithinCameroon(9.7, 4.05)).toBe(true);
  });

  it("accepts the bounds themselves", () => {
    expect(
      isWithinCameroon(CAMEROON_BOUNDS.minLongitude, CAMEROON_BOUNDS.minLatitude),
    ).toBe(true);
    expect(
      isWithinCameroon(CAMEROON_BOUNDS.maxLongitude, CAMEROON_BOUNDS.maxLatitude),
    ).toBe(true);
  });

  it("rejects a point just outside each edge", () => {
    expect(isWithinCameroon(7.99, 4.05)).toBe(false);
    expect(isWithinCameroon(17.01, 4.05)).toBe(false);
    expect(isWithinCameroon(9.7, 0.99)).toBe(false);
    expect(isWithinCameroon(9.7, 13.51)).toBe(false);
  });

  it("rejects non-finite coordinates", () => {
    // A NaN from a malformed value must not become a marker.
    expect(isWithinCameroon(Number.NaN, 4.05)).toBe(false);
    expect(isWithinCameroon(9.7, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("drawablePoints", () => {
  it("keeps points inside the envelope", () => {
    expect(drawablePoints([point(), point({ id: "b", longitude: 11.5 })])).toHaveLength(2);
  });

  it("drops a point outside the envelope rather than clamping it", () => {
    // Clamping would put a marker where the property is not, which is a false
    // claim about location.
    const kept = drawablePoints([
      point(),
      point({ id: "far", longitude: 40, latitude: 40 }),
    ]);
    expect(kept.map((entry) => entry.id)).toEqual(["listing-1"]);
  });

  it("handles an empty list", () => {
    expect(drawablePoints([])).toEqual([]);
  });
});

describe("viewForPoints", () => {
  it("returns the country view for no points", () => {
    expect(viewForPoints([])).toEqual(CAMEROON_VIEW);
  });

  it("centers on a single point at a close zoom", () => {
    const view = viewForPoints([point({ longitude: 9.7, latitude: 4.05 })]);
    expect(view.center).toEqual([9.7, 4.05]);
    expect(view.zoom).toBe(13);
  });

  it("centers on the middle of several points", () => {
    const view = viewForPoints([
      point({ id: "a", longitude: 9, latitude: 4 }),
      point({ id: "b", longitude: 11, latitude: 6 }),
    ]);
    expect(view.center).toEqual([10, 5]);
    expect(view.zoom).toBeLessThan(13);
  });

  it("ignores an undrawable point when framing", () => {
    // The far point must not drag the view out to it and make the real one a dot.
    const view = viewForPoints([
      point({ id: "near", longitude: 9.7, latitude: 4.05 }),
      point({ id: "far", longitude: 40, latitude: 40 }),
    ]);
    expect(view.center).toEqual([9.7, 4.05]);
  });

  it("returns the country view when every point is undrawable", () => {
    expect(viewForPoints([point({ longitude: 40, latitude: 40 })])).toEqual(
      CAMEROON_VIEW,
    );
  });
});

describe("zoomForSpan", () => {
  it("zooms in for a small span", () => {
    expect(zoomForSpan(0.02, 0.02)).toBe(13);
  });

  it("decreases as the span grows", () => {
    const zooms = [0.1, 0.5, 1.2, 2.5, 5, 20].map((span) =>
      zoomForSpan(span, span),
    );
    for (let i = 1; i < zooms.length; i += 1) {
      expect(zooms[i]!).toBeLessThanOrEqual(zooms[i - 1]!);
    }
  });

  it("falls back to the country zoom for a nationwide span", () => {
    expect(zoomForSpan(8, 11)).toBe(CAMEROON_VIEW.zoom);
  });
});

describe("toFeatureCollection", () => {
  it("builds a point feature per drawable point", () => {
    const collection = toFeatureCollection([point()]);
    expect(collection.type).toBe("FeatureCollection");
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.geometry.coordinates).toEqual([9.7, 4.05]);
    expect(collection.features[0]?.properties.label).toBe("KC-RE-000001");
  });

  it("uses the point id, so a popup can resolve a link", () => {
    const collection = toFeatureCollection([point({ id: "abc" })]);
    expect(collection.features[0]?.id).toBe("abc");
    expect(collection.features[0]?.properties.id).toBe("abc");
  });

  it("omits undrawable points", () => {
    const collection = toFeatureCollection([
      point(),
      point({ id: "far", longitude: 40, latitude: 40 }),
    ]);
    expect(collection.features).toHaveLength(1);
  });

  it("returns an empty collection for no points", () => {
    expect(toFeatureCollection([]).features).toEqual([]);
  });
});
