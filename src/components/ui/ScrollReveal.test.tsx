import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

/**
 * Scroll reveal behaviour.
 *
 * The property that matters is that the reveal is an enhancement rather than a
 * dependency: the content is in the DOM in every state, and the hidden/offset
 * styles are only ever applied by client code that can also undo them. These
 * tests drive the observer directly rather than waiting on real scrolling, so
 * they assert the contract the component makes with the CSS.
 */

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observers: Array<{
  callback: ObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  targets: Element[];
}> = [];

function installIntersectionObserver() {
  observers = [];
  class FakeObserver {
    callback: ObserverCallback;
    observe = vi.fn();
    disconnect = vi.fn();
    targets: Element[] = [];
    constructor(callback: ObserverCallback) {
      this.callback = callback;
      observers.push(this);
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
}

/** Force the "below the fold" decision the component makes on mount. */
function makeBelowFold() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 2000,
    bottom: 2100,
    left: 0,
    right: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 2000,
    toJSON: () => ({}),
  } as DOMRect);
}

function reduceMotion(enabled: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: enabled && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  installIntersectionObserver();
  makeBelowFold();
  reduceMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ScrollReveal", () => {
  it("renders its children", () => {
    render(
      <ScrollReveal>
        <p>Digital Marketing</p>
      </ScrollReveal>,
    );
    expect(screen.getByText("Digital Marketing")).toBeInTheDocument();
  });

  it("starts a below-the-fold element pending, then reveals it on intersection", () => {
    render(
      <ScrollReveal>
        <p>Revealed</p>
      </ScrollReveal>,
    );

    const wrapper = screen.getByText("Revealed").parentElement!;
    expect(wrapper).toHaveAttribute("data-reveal", "pending");

    act(() => observers[0]!.callback([{ isIntersecting: true }]));

    expect(wrapper).toHaveAttribute("data-reveal", "visible");
  });

  it("leaves no reveal attribute once visible, so the element rests in view", () => {
    render(
      <ScrollReveal delayMs={200}>
        <p>Staggered</p>
      </ScrollReveal>,
    );
    const wrapper = screen.getByText("Staggered").parentElement!;
    act(() => observers[0]!.callback([{ isIntersecting: true }]));

    expect(wrapper).toHaveAttribute("data-reveal", "visible");
    // The stagger travels as a custom property so one transition rule in the
    // stylesheet serves every card.
    expect(wrapper).toHaveStyle({ "--reveal-delay": "200ms" });
  });

  it("does not hide content when reduced motion is requested", () => {
    reduceMotion(true);
    render(
      <ScrollReveal>
        <p>Calm</p>
      </ScrollReveal>,
    );

    // No observer is created and no attribute is set, so the CSS resting state
    // applies and the content is simply visible.
    expect(observers).toHaveLength(0);
    expect(screen.getByText("Calm").parentElement!).not.toHaveAttribute(
      "data-reveal",
    );
  });

  it("does not hide content that is already on screen at mount", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 10,
      bottom: 110,
      left: 0,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 10,
      toJSON: () => ({}),
    } as DOMRect);

    render(
      <ScrollReveal>
        <p>Above the fold</p>
      </ScrollReveal>,
    );

    // Shown rather than hidden and re-shown: there is nothing to scroll to.
    expect(screen.getByText("Above the fold").parentElement!).toHaveAttribute(
      "data-reveal",
      "visible",
    );
    expect(observers).toHaveLength(0);
  });

  it("shows content rather than hiding it when IntersectionObserver is absent", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <ScrollReveal>
        <p>No observer</p>
      </ScrollReveal>,
    );

    expect(screen.getByText("No observer").parentElement!).not.toHaveAttribute(
      "data-reveal",
    );
  });

  it("can render as a list item so lists stay valid markup", () => {
    const { container } = render(
      <ul>
        <ScrollReveal as="li">
          <span>Electrical Services</span>
        </ScrollReveal>
      </ul>,
    );

    const item = container.querySelector("ul > li");
    expect(item).not.toBeNull();
    expect(item!.querySelector("span")).toHaveTextContent(
      "Electrical Services",
    );
  });

  it("disconnects the observer once the reveal has run", () => {
    render(
      <ScrollReveal>
        <p>Once</p>
      </ScrollReveal>,
    );

    act(() => observers[0]!.callback([{ isIntersecting: true }]));
    expect(observers[0]!.disconnect).toHaveBeenCalled();
  });
});
