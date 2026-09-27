"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { toggleListingFavoriteAction } from "@/lib/real-estate/customer-actions";

/**
 * The save/unsave control on a property card.
 *
 * A form submission rather than a client-side fetch, so the write goes through a
 * Server Action and is authorized on the server against the session. The
 * optimistic state is local: the heart fills immediately, and a failure rolls it
 * back and announces the reason. Waiting for the round trip instead makes the
 * control feel broken on a slow connection, and the write is a toggle, so a
 * duplicate submit is harmless.
 *
 * The button is a sibling of the card's link rather than inside it. A button
 * nested in an anchor is invalid HTML and, worse, activating it would also follow
 * the link — the visitor would be navigated to the listing they were trying to
 * save. The card places this control beside the anchor for exactly that reason.
 *
 * A signed-out visitor is not shown a disabled heart: the action reports
 * `unauthenticated` and the button sends them to sign-in with the current page as
 * the return target, because a disabled control explains nothing.
 */
export function FavoriteButton({
  locale,
  listingId,
  isFavorite,
  returnPath,
  title,
}: {
  locale: Locale;
  listingId: string;
  isFavorite: boolean;
  returnPath: string;
  title: string;
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();
  const [saved, setSaved] = useState(isFavorite);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = !saved;
          setSaved(next);
          setError(null);
          startTransition(async () => {
            const result = await toggleListingFavoriteAction(listingId);
            if (result.status === "unauthenticated") {
              setSaved(!next);
              router.push(
                `/admin/login?next=${encodeURIComponent(returnPath)}`,
              );
              return;
            }
            if (result.status !== "ok") {
              setSaved(!next);
              setError(t(`realEstate.favorites.errors.${result.status}`));
              return;
            }
            // The saved state is server-rendered on the favourites page and in the
            // results grid, so a refresh keeps the two consistent.
            router.refresh();
          });
        }}
      >
        <button
          type="submit"
          disabled={pending}
          aria-pressed={saved}
          aria-label={
            saved
              ? t("realEstate.favorites.remove", { title })
              : t("realEstate.favorites.add", { title })
          }
          className="inline-flex h-9 w-9 items-center justify-center rounded-pill border border-border bg-surface/95 text-body shadow-sm transition-soft hover:border-dept-accent disabled:opacity-60"
        >
          <Heart
            aria-hidden="true"
            className={`h-4 w-4 ${saved ? "fill-dept-accent text-dept-accent" : ""}`}
          />
        </button>
      </form>
      {error ? (
        <span role="status" className="visually-hidden">
          {error}
        </span>
      ) : null}
    </>
  );
}
