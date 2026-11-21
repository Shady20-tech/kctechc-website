import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The map's load watchdog.
 *
 * `PropertyMap` must never sit on "loading…" indefinitely: the surrounding list is
 * the real content, and a map that silently fails to arrive is worse than one
 * that says it could not be shown. The watchdog is the only thing that
 * distinguishes "the tiles are still coming" from "the style request is blocked",
 * so its lifecycle is worth pinning.
 *
 * This is a regression test for a specific defect: the timer used to be cleared
 * in a `finally` immediately after `new Map()` returned. Construction is
 * synchronous but the style and tiles are not, so the watchdog was disarmed
 * before the thing it watched for could happen — a blocked tile request left the
 * status on "loading" forever. The failure was invisible to `tsc`, to lint and to
 * the production build, and only showed up by watching a real browser.
 *
 * `maplibre-gl` is mocked because the point is the component's own state machine,
 * not MapLibre's rendering; the real library needs WebGL and a tile network, and
 * mocking the module is the only way to simulate "constructed but never loaded"
 * deterministically. The mock deliberately never fires `load`.
 */

const removeMock = vi.fn();

/** Every constructed map, so a test can fire the real `load` event. */
const constructed: FakeMap[] = [];

class FakeMap {
  handlers = new Map<string, (event?: unknown) => void>();
  constructor() {
    constructed.push(this);
  }
  on(event: string, handler: (payload?: unknown) => void) {
    this.handlers.set(event, handler);
    return this;
  }
  addSource() {
    return this;
  }
  addLayer() {
    return this;
  }
  getCanvas() {
    return { style: {} as CSSStyleDeclaration };
  }
  remove() {
    removeMock();
  }
}

vi.mock("maplibre-gl", () => ({
  Map: FakeMap,
  Popup: class {
    setLngLat() {
      return this;
    }
    setDOMContent() {
      return this;
    }
    addTo() {
      return this;
    }
  },
}));

const { PropertyMap } = await import("./PropertyMap");

const baseProps = {
  points: [
    {
      id: "listing-1",
      label: "KC-001",
      longitude: 9.2,
      latitude: 4.0,
    },
  ],
  styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  view: { center: [9.2, 4.0] as [number, number], zoom: 11 },
  ariaLabel: "Property locations",
  loadingLabel: "Loading map…",
  unavailableLabel: "The map could not be shown.",
};

describe("PropertyMap load watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    removeMock.mockClear();
    // jsdom has no canvas implementation and `getContext` throws "Not
    // implemented", which the component correctly reads as "no WebGL". The probe
    // has to succeed here so the effect reaches map construction, which is the
    // behaviour under test.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as unknown as RenderingContext,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports unavailable when the style never loads", async () => {
    render(<PropertyMap {...baseProps} />);

    // The library import resolves on a microtask; the status is still "loading"
    // at that point, which is the pre-existing behaviour.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(baseProps.loadingLabel)).toBeTruthy();

    // Nothing ever fires `load`. The watchdog must be the thing that gives up.
    await act(async () => {
      vi.advanceTimersByTime(13_000);
    });

    expect(screen.queryByText(baseProps.loadingLabel)).toBeNull();
    expect(screen.getByText(baseProps.unavailableLabel)).toBeTruthy();
  });

  it("does not report unavailable after a successful load", async () => {
    constructed.length = 0;
    render(<PropertyMap {...baseProps} />);
    await act(async () => {
      await Promise.resolve();
    });

    const map = constructed.at(-1);
    expect(map).toBeDefined();
    const loadHandler = map?.handlers.get("load");
    expect(loadHandler).toBeTypeOf("function");

    await act(async () => {
      loadHandler?.();
    });

    // Advancing past the timeout must not undo a ready map: the watchdog was
    // cleared on `load`, which is the whole point of moving it there.
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.queryByText(baseProps.unavailableLabel)).toBeNull();
    expect(screen.queryByText(baseProps.loadingLabel)).toBeNull();
  });
});
