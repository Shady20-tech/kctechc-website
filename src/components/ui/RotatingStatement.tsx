"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/use-client-environment";

/**
 * Rotating statement.
 *
 * The page's message must exist in the HTML, so every line is rendered by
 * default. Rotation is layered on only when the browser reports that motion is
 * welcome: at that point the lines collapse to one visible item and advance on a
 * timer.
 *
 * That ordering is what keeps this honest — a crawler, a no-JS visitor and a
 * reduced-motion visitor all receive the full statement, and only an animated
 * visitor sees a single line at a time.
 */
export function RotatingStatement({
  lines,
  className,
}: {
  lines: readonly string[];
  className?: string;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion || lines.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % lines.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, lines.length]);

  if (prefersReducedMotion || lines.length < 2) {
    return (
      <div className={className}>
        {lines.map((line, index) => (
          <p key={index} className={index > 0 ? "mt-2 text-muted" : undefined}>
            {line}
          </p>
        ))}
      </div>
    );
  }

  return (
    <p className={className} aria-live="off">
      <span key={active} className="statement-fade">
        {lines[active]}
      </span>
    </p>
  );
}
