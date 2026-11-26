"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleFavoriteAction } from "@/lib/favorites/actions";
import type { FavoriteEntityType } from "@/lib/favorites/types";
import {
  requestFavoriteSummary,
  useFavoriteIds,
} from "@/lib/hooks/use-favorite-ids";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * The save/unsave heart used by property cards, product cards and article cards.
 *
 * The heart fills immediately and rolls back on failure, because the write is a
 * toggle and a duplicate submit is harmless. The server action still decides
 * whether the caller is signed in and the database's own-row policies decide what
 * they may write.
 *
 * `defaultSaved` is the server-rendered state for pages that already loaded the
 * customer's favourites. Pages that must stay static — the store and insights
 * indexes — omit it; the module-level client store fills the heart after
 * hydration. A signed-out visitor is not shown a disabled control: the action
 * reports `unauthenticated` and the button sends them to sign in with the current
 * page as the return target.
 *
 * The button is a sibling of the card's link, never a descendant. A button inside
 * an anchor is invalid and would also follow the link when the heart is clicked.
 */
export function FavoriteButton({
  locale,
  entityType,
  entityId,
  defaultSaved = false,
  returnPath,
  title,
}: {
  locale: Locale;
  entityType: FavoriteEntityType;
  entityId: string;
  defaultSaved?: boolean;
  returnPath: string;
  title: string;
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();
  const ids = useFavoriteIds(entityType);
  const [override, setOverride] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saved = override ?? ids?.has(entityId) ?? defaultSaved;

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = !saved;
          setOverride(next);
          setError(null);
          startTransition(async () => {
            const result = await toggleFavoriteAction(entityType, entityId);
            if (result.status === "unauthenticated") {
              setOverride(null);
              router.push(`/login?next=${encodeURIComponent(returnPath)}`);
              return;
            }
            if (result.status !== "ok") {
              setOverride(null);
              setError(t(`favorites.errors.${result.status}`));
              return;
            }
            setOverride(result.saved);
            void requestFavoriteSummary(true);
            router.refresh();
          });
        }}
      >
        <button
          type="submit"
          disabled={pending}
          aria-pressed={saved}
          aria-busy={pending}
          aria-label={
            saved
              ? t("favorites.remove", { title })
              : t("favorites.add", { title })
          }
          className="inline-flex h-11 w-11 items-center justify-center rounded-pill border border-border bg-surface/95 text-body shadow-sm transition-soft hover:border-dept-accent disabled:opacity-60"
        >
          <Heart
            aria-hidden="true"
            className={`h-5 w-5 ${saved ? "fill-dept-accent text-dept-accent" : ""}`}
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
