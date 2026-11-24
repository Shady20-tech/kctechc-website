import Image from "next/image";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { formatDate } from "@/lib/content/format";
import type { LocalizedInsight } from "@/lib/content/types";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { INSIGHTS_PATH } from "@/lib/config/navigation";
import { contentMediaUrl } from "@/lib/uploads/media";

/**
 * One article card for the insights index and the category listing.
 *
 * The cover is the image the author uploaded with the article, resolved from the
 * stored object path rather than a baked URL — the same rule the rest of the
 * admin-managed media follows, so a project migration or custom domain does not
 * strand every cover at an old host.
 *
 * A card with no cover renders no media box at all rather than a placeholder.
 * An article published without a photograph is a normal case, and an empty grey
 * rectangle would suggest a failed image. The card still links the heading, so
 * the destination stays reachable and the layout keeps its grid rhythm because
 * the `flex-1` summary absorbs the height difference.
 */
export function InsightCard({
  article,
  locale,
  t,
  categoryName,
  priority = false,
  isFavorite,
}: {
  article: LocalizedInsight;
  locale: Locale;
  t: Translator["t"];
  categoryName?: string;
  /**
   * Set on the first card of a listing. Its cover is the largest element above
   * the fold, so lazy-loading it delays LCP until the browser has laid the grid
   * out; every later card stays lazy.
   */
  priority?: boolean;
  isFavorite?: boolean;
}) {
  const href = `/${locale}${INSIGHTS_PATH}/${article.slug}`;
  const cover = contentMediaUrl(article.coverImagePath);

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card transition-soft hover:border-border-strong">
      {article.id ? (
        <div className="absolute right-2.5 top-2.5 z-10">
          <FavoriteButton
            locale={locale}
            entityType="insight"
            entityId={article.id}
            defaultSaved={isFavorite ?? false}
            returnPath={href}
            title={article.title}
          />
        </div>
      ) : null}
      {cover ? (
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block aspect-video overflow-hidden border-b border-border bg-surface-sunken"
        >
          <Image
            src={cover}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1024px) 26rem, (min-width: 640px) 45vw, 100vw"
            className="object-cover transition-soft hover:scale-[1.02]"
          />
        </Link>
      ) : null}

      <div className="flex flex-1 flex-col p-6">
        {categoryName ? (
          <p className="mono-label text-dept-accent">{categoryName}</p>
        ) : null}
        <h3 className="mt-2 text-base font-semibold text-ink-900">
          <Link href={href} className="transition-soft hover:text-dept-accent">
            {article.title}
          </Link>
        </h3>
        <p className="mt-2 flex-1 text-sm text-body">{article.summary}</p>
        <p className="mt-4 text-xs text-muted">
          {t("insights.publishedOn", {
            date: formatDate(article.publishedAt, locale),
          })}
        </p>
      </div>
    </article>
  );
}
