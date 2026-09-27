import { ArrowRight, BedDouble, Bath, MapPin, Ruler } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { FavoriteButton } from "@/components/real-estate/FavoriteButton";
import { Badge } from "@/components/ui/Badge";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import {
  formatListingPrice,
  listingSlugForLocale,
} from "@/lib/real-estate/records";
import { propertyMediaPublicUrl } from "@/lib/real-estate/storage";
import type { PropertyListingRecord } from "@/lib/real-estate/types";

/**
 * Real-estate presentation components.
 *
 * These render only the public record. There is no prop, and no code path, that
 * could reach an owner's contact details or an exact coordinate, because the type
 * they accept has no field for either. That is the same arrangement the store
 * uses for product data: the guarantee is structural, not a matter of discipline
 * in each component.
 */

const PROPERTY_PATH = "/real-estate/listings";

/** The URL for a listing in a locale, using the locale's slug. */
export function listingHref(
  record: PropertyListingRecord,
  locale: Locale,
): string {
  return `/${locale}${PROPERTY_PATH}/${listingSlugForLocale(record, locale)}`;
}

/** The localized label for a listing type, status or property kind. */
export function listingTypeLabel(
  type: PropertyListingRecord["listingType"],
  t: Translator["t"],
): string {
  return t(`realEstate.types.${type}`);
}

export function listingKindLabel(
  kind: PropertyListingRecord["propertyKind"],
  t: Translator["t"],
): string {
  return t(`realEstate.kinds.${kind}`);
}

export function listingStatusLabel(
  status: PropertyListingRecord["status"],
  t: Translator["t"],
): string {
  return t(`realEstate.statuses.${status}`);
}

/**
 * The status badge tone.
 *
 * A concluded listing is deliberately muted rather than emphasised in green: a
 * sold property should not compete with the available ones for attention.
 */
export function listingStatusTone(
  status: PropertyListingRecord["status"],
): "neutral" | "success" | "warning" {
  if (status === "under_offer") return "warning";
  if (status === "published") return "success";
  return "neutral";
}

/** Format an area in square metres, or null when unknown. */
export function formatArea(area: number | undefined, t: Translator["t"]): string | null {
  if (area === undefined) return null;
  return `${new Intl.NumberFormat("en-CM").format(area)} ${t("realEstate.units.sqm")}`;
}

/** The card's key facts, as short labelled chips. */
export function listingFactChips(
  record: PropertyListingRecord,
  t: Translator["t"],
): string[] {
  const chips: string[] = [];
  if (record.bedrooms !== undefined) {
    chips.push(
      record.bedrooms === 1
        ? t("realEstate.units.bedroomsOne")
        : t("realEstate.units.bedrooms", { count: record.bedrooms }),
    );
  }
  if (record.bathrooms !== undefined) {
    chips.push(
      record.bathrooms === 1
        ? t("realEstate.units.bathroomsOne")
        : t("realEstate.units.bathrooms", { count: record.bathrooms }),
    );
  }
  const building = formatArea(record.buildingAreaSqm, t);
  if (building) chips.push(building);
  const land = formatArea(record.landAreaSqm, t);
  if (land) chips.push(land);
  return chips;
}

/**
 * A property card.
 *
 * A card is a whole-item link. The image is wrapped rather than given its own
 * link so a screen reader announces one target, not two that lead to the same
 * place.
 */
export function ListingCard({
  record,
  locale,
  t,
  isFavorite,
}: {
  record: PropertyListingRecord;
  locale: Locale;
  t: Translator["t"];
  /**
   * Whether the signed-in customer has saved this listing.
   *
   * Optional, and `undefined` means "do not render the save control". The landing
   * page and the detail page's related-listings rail pass nothing, because a save
   * control there would be a write offered in a place the customer is browsing
   * rather than choosing.
   */
  isFavorite?: boolean;
}) {
  const image = record.images.find((entry) => entry.isPrimary) ?? record.images[0];
  const imageUrl = image ? propertyMediaPublicUrl(image.storagePath) : null;
  const href = listingHref(record, locale);
  const chips = listingFactChips(record, t);

  return (
    <li className="group relative">
      {isFavorite !== undefined ? (
        <div className="absolute right-3 top-3 z-10">
          <FavoriteButton
            locale={locale}
            listingId={record.id}
            isFavorite={isFavorite}
            returnPath={href}
            title={record.title}
          />
        </div>
      ) : null}
      <Link
        href={href}
        className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface transition-soft hover:border-border-strong"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-alt">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={image?.alt ?? record.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-soft group-hover:scale-[1.02]"
            />
          ) : (
            // A listing without a photograph shows a labelled placeholder rather
            // than a stock image, which would misrepresent the property.
            <div className="flex h-full w-full items-center justify-center bg-surface-alt">
              <span className="mono-label text-muted">
                {t("realEstate.listing.galleryHeading")}
              </span>
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Badge tone="accent">{listingTypeLabel(record.listingType, t)}</Badge>
            {record.status !== "published" ? (
              <Badge tone={listingStatusTone(record.status)}>
                {listingStatusLabel(record.status, t)}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="font-display text-lg font-semibold text-ink-900">
            {formatListingPrice(record, locale)}
          </p>
          <h3 className="mt-1 text-base font-semibold text-ink-900">
            {record.title}
          </h3>

          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>
              {[record.locality, record.regionName].filter(Boolean).join(", ")}
            </span>
          </p>

          {chips.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-body">
              {chips.map((chip, index) => (
                <li key={`${chip}-${index}`} className="flex items-center gap-1.5">
                  {index === 0 ? (
                    <BedDouble aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                  ) : index === 1 ? (
                    <Bath aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                  ) : (
                    <Ruler aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                  )}
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-auto pt-4 text-sm font-medium text-dept-accent">
            {t("actions.learnMore")}
            <ArrowRight
              aria-hidden="true"
              className="ml-1 inline h-3.5 w-3.5 align-middle"
            />
          </p>
        </div>
      </Link>
    </li>
  );
}

/** A grid of property cards. */
export function ListingGrid({
  listings,
  locale,
  t,
  favoriteIds,
}: {
  listings: readonly PropertyListingRecord[];
  locale: Locale;
  t: Translator["t"];
  /**
   * The ids the signed-in customer has saved.
   *
   * A Set rather than a per-card boolean, so the grid stays a plain list: the
   * membership test happens here, once per card, against data the page already
   * loaded for the whole result set. Passing `undefined` omits the save control
   * entirely, which is what the surfaces that are not a browse context do.
   */
  favoriteIds?: ReadonlySet<string>;
}) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((record) => (
        <ListingCard
          key={record.id}
          record={record}
          locale={locale}
          t={t}
          isFavorite={favoriteIds ? favoriteIds.has(record.id) : undefined}
        />
      ))}
    </ul>
  );
}

/** A definition-list row, used by the detail page's facts and details blocks. */
export function FactRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-ink-900">{label}</dt>
      <dd className="text-sm text-body sm:col-span-2">{value}</dd>
    </div>
  );
}
