import { publicEnv } from "@/lib/config/env";

/**
 * Map adapter.
 *
 * The rest of the application never imports MapLibre. It passes a list of points
 * to a component, and this module decides which tile source and style that
 * component should use. That boundary is the whole point: the brief requires that
 * Mapbox or Google Maps can replace the default without touching business logic,
 * and the way to guarantee that is for no business module to name a map vendor.
 *
 * MapLibre GL JS + OpenFreeMap is the default. OpenFreeMap needs no API key and
 * no account, which means the map works in development, in a preview deployment
 * and in production without a secret to configure — and a missing secret cannot
 * silently disable a feature that a listing page depends on. When
 * `NEXT_PUBLIC_MAP_PROVIDER` names a provider that needs a token, the token is
 * read here and nowhere else.
 *
 * The functions in this file are pure and unit-tested. The MapLibre import lives
 * in the client component, loaded lazily, so the library is fetched only when a
 * visitor actually opens a map — it is not in the bundle of a page that merely
 * lists properties.
 */

export type MapProvider = "openfreemap" | "mapbox" | "google";

export const MAP_PROVIDERS: readonly MapProvider[] = [
  "openfreemap",
  "mapbox",
  "google",
];

export function isMapProvider(value: string): value is MapProvider {
  return (MAP_PROVIDERS as readonly string[]).includes(value);
}

/** A point on the map. Only ever a public, coarsened position. */
export type MapPoint = {
  id: string;
  /** Short label, e.g. a listing reference. */
  label: string;
  longitude: number;
  latitude: number;
  /** Radius of the published approximation, in metres, when known. */
  precisionMetres?: number;
};

export type MapView = {
  center: [number, number];
  zoom: number;
};

/**
 * The map's initial view: Cameroon.
 *
 * The country spans roughly 8.4°–16.2°E and 1.6°–13.1°N. The center and zoom
 * frame all ten regions at a glance, which is the right opening position for a
 * nationwide portfolio. A tighter frame would hide the north on a phone.
 */
export const CAMEROON_VIEW: MapView = {
  center: [11.5, 5.7],
  zoom: 5.4,
};

/**
 * Bounds for the coordinate validation the form and the database both apply.
 *
 * Slightly wider than the country so a border property is not rejected, but far
 * tighter than the globe. Exported so the form, the server action and this
 * adapter cannot disagree about what a plausible Cameroonian coordinate is.
 */
export const CAMEROON_BOUNDS = {
  minLongitude: 8.0,
  maxLongitude: 17.0,
  minLatitude: 1.0,
  maxLatitude: 13.5,
} as const;

/** The active provider, from the environment, with a safe default. */
export function activeMapProvider(): MapProvider {
  const configured = publicEnv.mapProvider;
  return isMapProvider(configured) ? configured : "openfreemap";
}

export type MapStyle = {
  /** Style URL suitable for MapLibre GL JS. */
  styleUrl: string;
  /** True when attribution must be shown (it always must). */
  requiresAttribution: boolean;
  /**
   * True when the configured provider cannot run — a token is required and
   * absent. The caller renders the list without the map rather than an empty
   * canvas with no tiles.
   */
  unavailable: boolean;
};

/**
 * Resolve the style URL for a provider.
 *
 * A provider that needs a token and has none is reported as `unavailable` rather
 * than substituted with another provider. Substituting would mean a deployment
 * that believes it is using one vendor's tiles while showing another's, which is
 * both a licensing problem and a support problem. Falling back to the list view
 * is honest and keeps the properties reachable.
 */
export function mapStyleFor(provider: MapProvider): MapStyle {
  switch (provider) {
    case "mapbox":
      if (!publicEnv.mapboxToken) {
        return { styleUrl: "", requiresAttribution: true, unavailable: true };
      }
      return {
        styleUrl: `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${publicEnv.mapboxToken}`,
        requiresAttribution: true,
        unavailable: false,
      };
    case "google":
      // Google vector tiles are not consumed by MapLibre through a style URL.
      // Declaring it unavailable keeps the failure visible instead of drawing an
      // empty map from a URL that was never going to work.
      return { styleUrl: "", requiresAttribution: true, unavailable: true };
    case "openfreemap":
    default:
      return {
        styleUrl: "https://tiles.openfreemap.org/styles/liberty",
        requiresAttribution: true,
        unavailable: false,
      };
  }
}

/** True when a coordinate pair is inside the plausible Cameroonian envelope. */
export function isWithinCameroon(
  longitude: number,
  latitude: number,
): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= CAMEROON_BOUNDS.minLongitude &&
    longitude <= CAMEROON_BOUNDS.maxLongitude &&
    latitude >= CAMEROON_BOUNDS.minLatitude &&
    latitude <= CAMEROON_BOUNDS.maxLatitude
  );
}

/**
 * Filter a set of points to those that can actually be drawn.
 *
 * A point outside the envelope, or with a non-finite coordinate, is dropped
 * rather than clamped. Clamping would place a property on the map at a position
 * it does not occupy, which is worse than omitting it: the marker is a factual
 * claim about where something is.
 */
export function drawablePoints(points: readonly MapPoint[]): MapPoint[] {
  return points.filter((point) =>
    isWithinCameroon(point.longitude, point.latitude),
  );
}

/**
 * The view that frames a set of points.
 *
 * A single point is centered on that point at a close zoom rather than framed by
 * a bounding box, because a box around one point has zero area and MapLibre then
 * chooses an arbitrary zoom. An empty list returns the country view.
 */
export function viewForPoints(points: readonly MapPoint[]): MapView {
  const drawable = drawablePoints(points);
  if (drawable.length === 0) return CAMEROON_VIEW;

  const only = drawable[0];
  if (drawable.length === 1 && only) {
    return { center: [only.longitude, only.latitude], zoom: 13 };
  }

  let minLongitude = Infinity;
  let maxLongitude = -Infinity;
  let minLatitude = Infinity;
  let maxLatitude = -Infinity;

  for (const point of drawable) {
    minLongitude = Math.min(minLongitude, point.longitude);
    maxLongitude = Math.max(maxLongitude, point.longitude);
    minLatitude = Math.min(minLatitude, point.latitude);
    maxLatitude = Math.max(maxLatitude, point.latitude);
  }

  return {
    center: [
      (minLongitude + maxLongitude) / 2,
      (minLatitude + maxLatitude) / 2,
    ],
    // A span of zero in one axis still needs a usable zoom; the 0.05 floor is
    // roughly a town.
    zoom: zoomForSpan(
      Math.max(maxLongitude - minLongitude, 0.05),
      Math.max(maxLatitude - minLatitude, 0.05),
    ),
  };
}

/**
 * A zoom that fits a longitude/latitude span.
 *
 * Tuned for a phone-height map. Deliberately conservative: showing a little more
 * than needed is better than clipping a property off the edge.
 */
export function zoomForSpan(
  longitudeSpan: number,
  latitudeSpan: number,
): number {
  const widest = Math.max(longitudeSpan, latitudeSpan * 1.4);
  if (widest <= 0.05) return 13;
  if (widest <= 0.2) return 11;
  if (widest <= 0.6) return 9.5;
  if (widest <= 1.5) return 8.2;
  if (widest <= 3) return 7;
  if (widest <= 6) return 6;
  return CAMEROON_VIEW.zoom;
}

/**
 * A GeoJSON FeatureCollection for the points.
 *
 * Clustering is done by the map's source (`cluster: true`) rather than in this
 * module: MapLibre's clustering handles zoom transitions without recomputing
 * groups in JavaScript on every pan, which is what keeps a nationwide portfolio
 * usable on a mid-range Android device.
 *
 * The returned value is a plain object so the adapter can be tested without the
 * maplibre module being present.
 */
export function toFeatureCollection(points: readonly MapPoint[]): {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    properties: { id: string; label: string };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
} {
  return {
    type: "FeatureCollection",
    features: drawablePoints(points).map((point) => ({
      type: "Feature",
      id: point.id,
      properties: { id: point.id, label: point.label },
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
    })),
  };
}
