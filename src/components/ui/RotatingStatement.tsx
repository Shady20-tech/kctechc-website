"use client";

import { useEffect, useState } from "react";

/**
 * Rotating bilingual statement line for the corporate gateway.
 *
 * All lines are present in the server-rendered HTML; the inactive ones carry the
 * `hidden` attribute and are `aria-hidden`, so assistive technology announces
 * only the active line and never the full stack at once. Rotation is an
 * enhancement on top of content that is already complete without it.
 *
 * There is deliberately no separate screen-reader-only copy of the active line:
 * that would announce the same sentence twice. `aria-live` on the wrapper is
 * enough to surface a change.
 *
 * The interval pauses while the tab is hidden, so a backgrounded gateway is not
 * animating and re-rendering for nobody. `prefers-reduced-motion` disables
 * rotation entirely, leaving the first line as static text.
 */
export function RotatingStatement({
  lines,
  intervalMs = 5200,
  className,
}: {
  lines: readonly string[];
  intervalMs?: number;
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || lines.length < 2) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % lines.length),
      intervalMs,
    );

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [paused, lines.length, intervalMs]);

  return (
    <div className={className} aria-live="polite">
      {lines.map((line, index) => (
        <p
          key={line}
          hidden={index !== active}
          aria-hidden={index !== active ? "true" : undefined}
          className={index === active ? "statement-fade" : undefined}
        >
          {line}
        </p>
      ))}
    </div>
  );
}
