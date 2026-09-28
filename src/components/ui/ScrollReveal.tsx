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
 */
export function ScrollReveal({
  children,
  as: Tag = "div",
  delayMs = 0,
  className,
  style,
  ...rest
}: {
  children: ReactNode;
  /** Element to render. Defaults to `div`; use `li` inside a list. */
  as?: ElementType;
  /** Stagger offset in milliseconds: 0, 100, 200 across a set of three. */
  delayMs?: number;
  className?: string;
  style?: CSSProperties;
} & Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "className" | "style"
>) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "visible">("idle");

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

  return (
    <Tag
      // The ref is read inside the effect above and during observer setup, never
      // during render, so it cannot make the rendered output depend on a mutable
      // value.
      ref={ref}
      className={className}
      style={{ ...style, "--reveal-delay": `${delayMs}ms` } as CSSProperties}
      {...revealProps}
      {...rest}
    >
      {children}
    </Tag>
  );
}
