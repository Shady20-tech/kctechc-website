import type { ReactNode } from "react";

/** Consistent page intro used by every department and content page. */
export function PageIntro({
  eyebrow,
  heading,
  intro,
  children,
}: {
  eyebrow?: string;
  heading: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-3xl font-bold text-navy-900 sm:text-4xl">
        {heading}
      </h1>
      {intro ? <p className="mt-4 text-base text-body">{intro}</p> : null}
      {children}
    </div>
  );
}
