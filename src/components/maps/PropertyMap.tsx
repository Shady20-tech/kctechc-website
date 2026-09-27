"use client";

import { useEffect, useRef, useState } from "react";

import type { MapPoint, MapView } from "@/lib/maps/adapter";
import { toFeatureCollection } from "@/lib/maps/adapter";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The map surface.
 *
 * A Client Component and the only place MapLibre is named. The library is
 * imported dynamically inside the effect, so it is a separate chunk fetched when a
 * visitor opens a map — a page that merely lists properties never downloads it.
 *
 * The component is deliberately forgiving. If the library fails to load, the tile
 * style fails, or the browser lacks WebGL, the map reports that it could not be
 * shown and the caller's list remains — the properties stay reachable. A map is a
 * convenience over the list, never the only way to reach a listing.
 *
 * Exact coordinates never reach this component. It is given the coarsened public
 * positions from `listing_locations_api`, and the popup says so: a marker is a
 * claim about where something is, and for a private listing that claim must be
 * "around here", not "here".
 */

export type PropertyMapProps = {
  points: readonly MapPoint[];
  styleUrl: string;
  view: MapView;
  /** Group nearby markers when true; used by the search map. */
  cluster?: boolean;
  /** Listing id → URL, so a popup can link to the property. */
  hrefById?: Record<string, string>;
  ariaLabel: string;
  loadingLabel: string;
  unavailableLabel: string;
  /** Rendered in each popup below the label. */
  openLabel?: string;
  className?: string;
};

/** How long to wait for the library before giving up on the map. */
const LOAD_TIMEOUT_MS = 12_000;

export function PropertyMap({
  points,
  styleUrl,
  view,
  cluster = false,
  hrefById = {},
  ariaLabel,
  loadingLabel,
  unavailableLabel,
  openLabel,
  className,
}: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const fail = () => {
      if (!cancelled) setStatus("unavailable");
    };

    async function start() {
      // WebGL is required and its absence is the common failure on old or
      // locked-down browsers. Probed inside the async start rather than in the
      // effect body: setting state synchronously in an effect triggers a
      // cascading render, and this check does not need to run before the first
      // paint.
      try {
        const probe = document.createElement("canvas");
        const hasWebgl =
          typeof probe.getContext === "function" &&
          Boolean(
            probe.getContext("webgl2") ??
              probe.getContext("webgl") ??
              probe.getContext("experimental-webgl"),
          );
        if (!hasWebgl) {
          fail();
          return;
        }
      } catch {
        fail();
        return;
      }

      try {
        timeout = setTimeout(fail, LOAD_TIMEOUT_MS);
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        map = new maplibre.Map({
          container: containerRef.current,
          style: styleUrl,
          center: view.center,
          zoom: view.zoom,
          // The map is decorative for the surrounding page and is labelled by it.
          attributionControl: { compact: true },
        });

        map.on("load", () => {
          if (cancelled || !map) return;
          setStatus("ready");

          map.addSource("properties", {
            type: "geojson",
            data: toFeatureCollection(points),
            cluster,
            clusterRadius: 50,
            clusterMaxZoom: 11,
          });

          if (cluster) {
            map.addLayer({
              id: "clusters",
              type: "circle",
              source: "properties",
              filter: ["has", "point_count"],
              paint: {
                "circle-color": "#127A5B",
                "circle-opacity": 0.85,
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  16,
                  10,
                  20,
                  50,
                  26,
                ],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
              },
            });
            map.addLayer({
              id: "cluster-count",
              type: "symbol",
              source: "properties",
              filter: ["has", "point_count"],
              layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": 12,
              },
              paint: { "text-color": "#ffffff" },
            });
          }

          map.addLayer({
            id: "points",
            type: "circle",
            source: "properties",
            filter: cluster ? ["!", ["has", "point_count"]] : undefined,
            paint: {
              "circle-color": "#127A5B",
              "circle-radius": 7,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });

          map.on("click", "points", (event) => {
            const feature = event.features?.[0];
            if (!feature || !map) return;
            const id = String(feature.properties?.id ?? "");
            const label = String(feature.properties?.label ?? "");
            const href = hrefById[id];

            const content = document.createElement("div");
            content.className = "text-sm";
            const heading = document.createElement("p");
            heading.className = "font-semibold text-ink-900";
            heading.textContent = label;
            content.appendChild(heading);
            if (href && openLabel) {
              const link = document.createElement("a");
              link.href = href;
              link.textContent = openLabel;
              link.className = "mt-1 inline-block underline";
              content.appendChild(link);
            }

            new maplibre.Popup({ closeButton: true, offset: 12 })
              .setLngLat(
                (feature.geometry as { coordinates?: [number, number] })
                  .coordinates ?? view.center,
              )
              .setDOMContent(content)
              .addTo(map);
          });

          map.on("mouseenter", "points", () => {
            if (map) map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "points", () => {
            if (map) map.getCanvas().style.cursor = "";
          });
        });

        map.on("error", fail);
      } catch {
        fail();
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      map?.remove();
    };
    // Recreating the map when the point set changes is correct: the source data
    // is the whole of what the map shows, and diffing it in place would mean
    // tracking source updates for no visible benefit.
  }, [points, styleUrl, view, cluster, hrefById, openLabel]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        role="img"
        aria-label={ariaLabel}
        className="h-80 w-full overflow-hidden rounded-card border border-border bg-surface-alt sm:h-96"
      />
      {/* Status is announced rather than drawn over the map, so a screen reader
          hears why the map is missing and a sighted reader sees it too. */}
      <p aria-live="polite" className="mt-2 text-xs text-muted">
        {status === "loading" ? loadingLabel : null}
        {status === "unavailable" ? unavailableLabel : null}
      </p>
    </div>
  );
}
