"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * Scroll-triggered entrance.
 *
 * Wraps a block of content and slides it up as it enters the viewport. The
 * animation is a pure enhancement on top of fully rendered markup:
 *
 *   - The server renders the children with no `data-reveal` attribute at all, so
 *     the default CSS state is the visible resting state. A crawler, a
 *     no-JavaScript visitor or a pre-hydration paint sees the content in place, at
 *     full opacity.
 *   - On mount the attribute becomes `pending`, which offsets the element by 20px
 *     and drops it to opacity 0 — but only in a browser that can animate it back.
 *   - When the element intersects the viewport the attribute becomes `visible` and
 *     the transition runs.
 *
 * Content is never conditionally unmounted, never given `hidden` and never removed
 * from the DOM. The three states differ only in `opacity` and `transform` — both
 * compositor-only properties — so the section is always present in the HTML a
 * search engine reads.
 *
 * `pending` is applied in an effect rather than during render on purpose: setting
 * it in the first render would emit `data-reveal="pending"` in the server HTML,
 * which is the flash of invisible content for crawlers this design avoids.
 *
 * `as` exists so the wrapper can *be* the semantic element — an `<li>` inside a
 * list, say — instead of adding a `<div>` between a `<ul>` and its items, which
 * would be invalid markup and would break the grid.
 *
 * Three cases deliberately stay in the resting (visible) state:
 *   - no `IntersectionObserver`, so nothing could drive the transition;
 *   - `prefers-reduced-motion: reduce`, where the CSS also drops the offset;
 *   - an element already on screen at mount, so it is shown as-is rather than
 *     hidden behind an animation the visitor did not scroll to trigger.
 *
 * `stagger` is the opt-in for a grid whose rows are taller than the viewport.
 * A uniform `delayMs` gives every item the same offset, so the last row starts
 * its 620ms transition while the first is still finishing and the grid reads as
 * one lump. With `stagger` the per-item delay is derived from the item's own
 * position within a row and its row index, so the wave travels down the grid in
 * order.
 *
 * The delay is breakpoint-dependent — the grid is one, two or three columns —
 * but resolving that in JavaScript would mean `matchMedia` state, which the
 * `react-hooks/set-state-in-effect` rule (correctly) rejects. Instead all three
 * values are precomputed and written as custom properties, and the stylesheet
 * selects the right one per breakpoint. The computation is pure and deterministic,
 * so the server render and the client render agree and nothing depends on a
 * measurement.
 */
export function ScrollReveal({
  children,
  as: Tag = "div",
  delayMs = 0,
  stagger,
  className,
  style,
  ...rest
}: {
  children: ReactNode;
  /** Element to render. Defaults to `div`; use `li` inside a list. */
  as?: ElementType;
  /** Stagger offset in milliseconds: 0, 100, 200 across a set of three. */
  delayMs?: number;
  /**
   * Derive the delay from a grid position instead of using `delayMs` directly.
   * The column count may be a single number (every breakpoint) or a base/md/lg
   * triple matching the grid's `sm`/`lg` classes.
   */
  stagger?: {
    index: number;
    columns: number | readonly [number, number, number];
    stepMs?: number;
  };
  className?: string;
  style?: CSSProperties;
} & Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "className" | "style"
>) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "visible">("idle");

  // One value per breakpoint, all resolved up front. A uniform `delayMs` writes
  // the same value three times so the media queries below stay inert.
  const delays = staggerDelayVars(stagger, delayMs);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Already in view on mount: show it rather than hiding and re-showing a block
    // the visitor never scrolled to.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setState("visible");
      return;
    }

    setState("pending");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setState("visible");
          observer.disconnect();
        }
      },
      // Start slightly before the block is fully on screen, so it has settled by
      // the time it is centred.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const revealProps =
    state === "idle" ? {} : { "data-reveal": state as "pending" | "visible" };

  // The stagger class is what lets the stylesheet pick a breakpoint-specific
  // delay; a uniform delay has no such class and keeps its inline value.
  const combinedClassName = [className, stagger ? "reveal-stagger" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      // The ref is read inside the effect above and during observer setup, never
      // during render, so it cannot make the rendered output depend on a mutable
      // value.
      ref={ref}
      className={combinedClassName || undefined}
      style={{ ...style, ...delays } as CSSProperties}
      {...revealProps}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Row-to-row and column-to-column offsets for the grid stagger. */
const ROW_STEP_MS = 150;
const COLUMN_STEP_MS = 80;

/**
 * The three breakpoint delays for an item, as custom properties.
 *
 * The grid classes are `sm:grid-cols-2 lg:grid-cols-3`, so the item's column
 * index — and therefore its within-row offset — changes at 640px and 1024px.
 * Each is computed here and the stylesheet picks one; nothing is read from the
 * browser.
 */
function staggerDelayVars(
  stagger:
    | {
        index: number;
        columns: number | readonly [number, number, number];
        stepMs?: number;
      }
    | undefined,
  delayMs: number,
): CSSProperties {
  if (!stagger) {
    return { "--reveal-delay": `${delayMs}ms` } as CSSProperties;
  }

  const step = stagger.stepMs ?? COLUMN_STEP_MS;
  const columns =
    typeof stagger.columns === "number"
      ? [stagger.columns, stagger.columns, stagger.columns]
      : stagger.columns;
  const [base, md, lg] = columns.map(
    (count) =>
      Math.floor(stagger.index / count) * ROW_STEP_MS +
      (stagger.index % count) * step,
  );

  // Deliberately no `--reveal-delay`: an inline custom property would beat the
  // stylesheet's breakpoint override. The `.reveal-stagger` rule maps these three
  // to the active `--reveal-delay` per breakpoint.
  return {
    "--reveal-delay-base": `${base}ms`,
    "--reveal-delay-sm": `${md}ms`,
    "--reveal-delay-lg": `${lg}ms`,
  } as CSSProperties;
}
