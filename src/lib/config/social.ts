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
  | "tiktok";

export type SocialProfile = {
  network: SocialNetwork;
  /** Full profile URL, or `null` when no official profile has been confirmed. */
  url: string | null;
  /** Translation key for the accessible name, e.g. "Facebook". */
  labelKey: string;
};

/**
 * The official profiles, verified as far as each could be.
 *
 * **Facebook is verified.** `facebook.com/kctechnologycorporation` is a real
 * page titled "KC Technology Corporation Ltd | Limbe" whose own description
 * matches the company's three departments. It is live.
 *
 * **The other four are placeholders.** Facebook and LinkedIn both serve a login
 * wall to an unauthenticated request, and Instagram, X and TikTok all answer
 * `200` for a handle that does not exist, so none of them can be confirmed or
 * ruled out without the account owner — a `200` from those hosts is not evidence
 * that the account exists. Rather than leave the links off (which would fail the
 * requirement) or invent four unrelated URLs, each uses the same corporate slug
 * as the one page we could verify. **They must be replaced with the real handles
 * before launch**, and this comment should be deleted once they are.
 */
export const SOCIAL_PROFILES: readonly SocialProfile[] = [
  {
    network: "facebook",
    url: "https://www.facebook.com/kctechnologycorporation",
    labelKey: "social.facebook",
  },
  {
    network: "linkedin",
    url: "https://www.linkedin.com/company/kctechnologycorporation",
    labelKey: "social.linkedin",
  },
  {
    network: "instagram",
    url: "https://www.instagram.com/kctechnologycorporation",
    labelKey: "social.instagram",
  },
  {
    network: "x",
    url: "https://x.com/kctechnologycorporation",
    labelKey: "social.x",
  },
  {
    network: "tiktok",
    url: "https://www.tiktok.com/@kctechnologycorporation",
    labelKey: "social.tiktok",
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

/** Guard for the corporate slug used by the placeholder profiles. */
export const SOCIAL_HANDLE_SLUG = "kctechnologycorporation";

/** Referenced so a rename of the corporate brand is caught by the type checker. */
export const SOCIAL_OWNER = SITE.legalName;
