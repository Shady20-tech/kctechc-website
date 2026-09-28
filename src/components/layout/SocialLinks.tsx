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
 */
export function SocialLinks({ t }: { t: Translator["t"] }) {
  if (ACTIVE_SOCIAL_PROFILES.length === 0) return null;

  return (
    <nav aria-labelledby="footer-social-heading" className="mt-6">
      <h2 id="footer-social-heading" className="mono-label text-teal-300">
        {t("footer.socialHeading")}
      </h2>
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-card border border-white/15 text-white/75 transition-soft hover:border-teal-300/60 hover:bg-white/10 hover:text-white"
            >
              <SocialIcon network={profile.network} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
