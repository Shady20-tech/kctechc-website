import Image from "next/image";

import { avatarPublicUrl } from "@/lib/uploads/media";

const SIZES = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-2xl",
} as const;

/**
 * Profile picture, with a deterministic initials fallback.
 *
 * The fallback is not decoration: most accounts will never upload a picture, so
 * the initials path is the common one and gets the same deliberate treatment as
 * the image path. Initials are derived from the display name where there is one
 * and from the email local part otherwise, so a user with no name still gets
 * something that identifies them rather than a generic icon.
 *
 * When a picture exists it is rendered through `next/image`, which is why the
 * Supabase host is in `images.remotePatterns`; a bare `<img>` would bypass the
 * size optimisation and the layout-shift reservation.
 */
export function Avatar({
  src,
  name,
  size = "md",
}: {
  src: string | null;
  name: string;
  size?: keyof typeof SIZES;
}) {
  const url = src ?? null;
  const initial = initialsFor(name);

  const className = `${SIZES[size]} shrink-0 rounded-full`;

  if (url) {
    return (
      <span className={`${className} relative overflow-hidden bg-ink-700`}>
        <Image
          src={url}
          alt=""
          fill
          sizes="(max-width: 1024px) 48px, 80px"
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex items-center justify-center bg-ink-600 font-semibold uppercase text-white`}
    >
      {initial}
    </span>
  );
}

/** Resolve a profile picture URL from its stored path, or null. */
export function resolveAvatarUrl(path: string | null | undefined): string | null {
  return avatarPublicUrl(path);
}

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (cleaned.length === 0) return "?";

  // A display name gives up to two initials; an email address gives one, taken
  // from the local part so "jo.an@example.com" reads as "J" rather than "@".
  const source = (cleaned.includes("@") ? cleaned.split("@")[0] : cleaned) ?? "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.charAt(0).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}
