import type { ReactNode } from "react";

import { BackLink } from "@/components/ui/BackLink";

/** Consistent page intro used by every department and content page. */
export function PageIntro({
  eyebrow,
  heading,
  intro,
  back,
  children,
}: {
  eyebrow?: string;
  heading: string;
  intro?: string;
  /** Optional link to the list or parent page this page was opened from. */
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      {back ? (
        <BackLink href={back.href} label={back.label} className="mb-4" />
      ) : null}
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-dept-accent">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-3xl font-bold text-ink-900 sm:text-4xl">
        {heading}
      </h1>
      {intro ? <p className="mt-4 text-base text-body">{intro}</p> : null}
      {children}
    </div>
  );
}
