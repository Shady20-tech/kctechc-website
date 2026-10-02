import { SITE } from "@/lib/config/site";

/**
 * Corporate social profiles.
 *
 * `null` means "no profile supplied", and a `null` entry is **not rendered**.
 * That is the whole point of this shape: the business brief lists the email,
 * phones and address as verified facts and supplies no social handles at all, so
 * anything placed here is an unverified assumption. Keeping the empty slots in
 * the type lets a network be switched on by filling in one string, and stops the
 * footer from silently linking a visitor to an account that is not ours — a
 * wrong brand link is worse than an absent one, because it looks authoritative.
 *
 * To publish a profile: replace the `null` with the full URL. The footer and the
 * `Organization` structured data both read this object, so one edit keeps the
 * visible links and the machine-readable `sameAs` in agreement.
 */
export type SocialNetwork =
  | "facebook"
  | "linkedin"
  | "instagram"
  | "x"
  | "tiktok"
  | "youtube";

export type SocialProfile = {
  network: SocialNetwork;
  /** Full profile URL, or `null` when no official profile has been confirmed. */
  url: string | null;
  /** Translation key for the accessible name, e.g. "Facebook". */
  labelKey: string;
};

/**
 * The official profiles, taken from the company's own business profile.
 *
 * Every URL below is copied from section 5.5 ("Social Media Handles") of the
 * supplied KC Technology Corporation business profile, so each is the company's
 * own published link rather than an assumed handle. Instagram's entry in the
 * source document is written without a scheme (`instragram.com/kctechc`); the
 * host is normalised to `https://www.instagram.com` and the handle preserved.
 */
export const SOCIAL_PROFILES: readonly SocialProfile[] = [
  {
    network: "facebook",
    url: "https://www.facebook.com/share/1BAqM3Jua8/",
    labelKey: "social.facebook",
  },
  {
    network: "linkedin",
    url: "https://www.linkedin.com/company/kc-technology-corporation/",
    labelKey: "social.linkedin",
  },
  {
    network: "instagram",
    url: "https://www.instagram.com/kctechc",
    labelKey: "social.instagram",
  },
  {
    network: "x",
    url: "https://x.com/kctechnologyco",
    labelKey: "social.x",
  },
  {
    network: "tiktok",
    url: "https://www.tiktok.com/@kctechc",
    labelKey: "social.tiktok",
  },
  {
    network: "youtube",
    url: "https://www.youtube.com/@KCTechnologyCorporation",
    labelKey: "social.youtube",
  },
] as const;

/** The profiles that have a confirmed URL, in display order. */
export const ACTIVE_SOCIAL_PROFILES: readonly (SocialProfile & {
  url: string;
})[] = SOCIAL_PROFILES.filter(
  (profile): profile is SocialProfile & { url: string } => profile.url !== null,
);

/**
 * Profile URLs that belong to this organisation, for schema.org `sameAs`.
 *
 * Only absolute `http(s)` URLs on a host that is not this site are emitted. The
 * index exists to tell a search engine which *other* sites this organisation is
 * the same entity as, so a same-site URL would be a meaningless claim and a
 * relative one an invalid one.
 */
export function socialProfileUrls(): readonly string[] {
  return ACTIVE_SOCIAL_PROFILES.filter((profile) => {
    try {
      const url = new URL(profile.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return false;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
      if (!siteUrl) return true;
      return url.hostname !== new URL(siteUrl).hostname;
    } catch {
      return false;
    }
  }).map((profile) => profile.url);
}

/** The organisation's `sameAs` list, or `undefined` when none are configured. */
export function organizationSameAs(): readonly string[] | undefined {
  const urls = socialProfileUrls();
  return urls.length > 0 ? urls : undefined;
}

/** Referenced so a rename of the corporate brand is caught by the type checker. */
export const SOCIAL_OWNER = SITE.legalName;
