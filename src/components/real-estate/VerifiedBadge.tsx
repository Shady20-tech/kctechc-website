import { BadgeCheck } from "lucide-react";

import type { Translator } from "@/lib/i18n/translator";

/**
 * The verified-publisher mark.
 *
 * Shown only for a listing whose `publisherVerified` flag is true, which the
 * database maintains from an approved membership a super admin granted a
 * verification badge to. It is never inferred from an approval or from a
 * self-declared account type.
 *
 * The accessible label carries the full meaning: `badgeTitle` says KC Technology
 * reviewed the publisher's identity and that this is *not* a government guarantee
 * of land title. The short visible text is only "Verified", so the distinction the
 * brief insists on is announced rather than left to a tooltip alone.
 */
export function VerifiedBadge({
  t,
  className,
}: {
  t: Translator["t"];
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border border-teal-300 bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700 ${className ?? ""}`}
      title={t("realEstate.verified.badgeTitle")}
    >
      <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
      {t("realEstate.verified.badgeShort")}
      <span className="visually-hidden">
        {" — "}
        {t("realEstate.verified.badgeTitle")}
      </span>
    </span>
  );
}
