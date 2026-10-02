import { SocialIcon } from "@/components/icons/SocialIcon";
import { ACTIVE_SOCIAL_PROFILES } from "@/lib/config/social";
import type { Translator } from "@/lib/i18n/translator";

/**
 * The corporate social links, rendered from `SOCIAL_PROFILES`.
 *
 * Every link opens in a new tab, because a visitor who leaves the site to look at
 * a social profile should not lose their place in the site. `target="_blank"`
 * without `rel="noopener"` hands the opened page a live `window.opener`
 * reference; `noreferrer` additionally keeps the destination from reading the
 * referral. Both are applied together.
 *
 * The accessible name states the company and the network ("KC Technology
 * Corporation on Facebook"), not just the network, because a screen-reader user
 * navigating a link list hears five unlabelled destinations otherwise. The
 * brand mark itself is `aria-hidden`, so there is no duplicated name and nothing
 * for the label-content-mismatch rule to catch.
 *
 * Each target is a 40px square. That clears the 24px WCAG 2.2 minimum
 * comfortably rather than marginally, which matters here because these five
 * links are adjacent and closely spaced — a row of exactly-minimum targets is
 * easy to mis-tap.
 *
 * `tone` selects the border and text colours for the surface the row sits on:
 * `ink` for the dark footer band, `light` for a page band. The two palettes are
 * not interchangeable — white borders on a light band are invisible, and ink
 * borders on the footer vanish against `ink-950`.
 *
 * `headingId` controls whether the component renders its own visible heading. The
 * footer passes one; a page that already has a section heading (About) omits it,
 * so the document does not carry two headings and two elements with the same id.
 * The landmark is labelled either way — by the heading when present, by
 * `ariaLabel` otherwise.
 */
export function SocialLinks({
  t,
  tone = "ink",
  className = "mt-6",
  headingId,
  ariaLabel,
}: {
  t: Translator["t"];
  tone?: "ink" | "light";
  className?: string;
  /** Render a visible heading with this id; omit when the page supplies one. */
  headingId?: string;
  /** Landmark name when no heading is rendered. Defaults to the footer heading. */
  ariaLabel?: string;
}) {
  if (ACTIVE_SOCIAL_PROFILES.length === 0) return null;

  const linkClass =
    tone === "ink"
      ? "border-white/15 text-white/75 hover:border-teal-300/60 hover:bg-white/10 hover:text-white"
      : "border-border text-ink-700 hover:border-dept-accent hover:bg-surface hover:text-dept-accent";

  return (
    <nav
      aria-labelledby={headingId}
      aria-label={
        headingId ? undefined : (ariaLabel ?? t("footer.socialHeading"))
      }
      className={className}
    >
      {headingId ? (
        <h2
          id={headingId}
          className={`mono-label ${tone === "ink" ? "text-teal-300" : "text-ink-500"}`}
        >
          {t("footer.socialHeading")}
        </h2>
      ) : null}
      <ul className="mt-3 flex flex-wrap items-center gap-2">
        {ACTIVE_SOCIAL_PROFILES.map((profile) => (
          <li key={profile.network}>
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("footer.socialLinkLabel", {
                network: t(profile.labelKey),
              })}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-control border transition-soft ${linkClass}`}
            >
              <SocialIcon network={profile.network} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
