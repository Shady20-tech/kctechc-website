import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { PackageCartControls } from "@/components/solar/PackageCartControls";
import type { SolarPackage } from "@/lib/content/solar-packages";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { formatPrice } from "@/lib/store/types";

/**
 * One solar package card.
 *
 * Server-rendered: the name, price, breakdown, panel count and bill of materials
 * are all in the HTML before any script runs, so a crawler and a no-JavaScript
 * visitor get the complete offer. The only interactive part is the
 * add-to-cart/request-info control, which is its own Client Component.
 *
 * Prices come from the bundled brochure data, not from a client value. The card
 * states plainly that the figure is indicative and to be confirmed — the
 * brochure's own caveat, and the reason checkout ends with a human contact.
 */
export function PackageCard({
  pkg,
  t,
  locale,
  productId,
}: {
  pkg: SolarPackage;
  t: Translator["t"];
  locale: Locale;
  productId: string | null;
}) {
  const name = t(`solarPackages.items.${pkg.id}.name`);
  const tag = t(`solarPackages.items.${pkg.id}.tag`);
  const suitedFor = t(`solarPackages.items.${pkg.id}.suitedFor`);
  const summary = t(`solarPackages.items.${pkg.id}.summary`);
  const alt = t(`solarPackages.items.${pkg.id}.alt`);

  const requestHref = `/${locale}/contact?department=electrical-services&package=${pkg.id}`;

  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card transition-soft hover:border-border-strong"
      data-package={pkg.id}
    >
      <div className="relative aspect-video overflow-hidden border-b border-border bg-surface-sunken">
        <Image
          src={pkg.image}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 30rem, (min-width: 640px) 45vw, 100vw"
          className="object-cover transition-soft group-hover:scale-[1.02]"
        />
        <span className="absolute left-3 top-3">
          <Badge tone={pkg.highlighted ? "warning" : "neutral"}>{tag}</Badge>
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-xl font-bold text-ink-900">{name}</h3>
        <p className="mono-label mt-1 text-muted">{suitedFor}</p>

        <p className="mt-4 text-sm leading-relaxed text-body">{summary}</p>

        <dl className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">
              {t("solarPackages.labels.materials")}
            </dt>
            <dd className="tabular-nums text-ink-900">
              {formatPrice(pkg.materialsMinor, "XAF", locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">
              {t("solarPackages.labels.accessoriesPercent", {
                percent: pkg.accessoriesPercent,
              })}
            </dt>
            <dd className="tabular-nums text-ink-900">
              {formatPrice(pkg.accessoriesMinor, "XAF", locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">
              {t("solarPackages.labels.installationPercent", {
                percent: pkg.installationPercent,
              })}
            </dt>
            <dd className="tabular-nums text-ink-900">
              {formatPrice(pkg.installationMinor, "XAF", locale)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <dt>{t("solarPackages.labels.totalPrice")}</dt>
            <dd className="tabular-nums text-ink-900">
              {formatPrice(pkg.priceMinor, "XAF", locale)}
            </dd>
          </div>
        </dl>

        <p className="mono-label mt-4 text-muted">
          {pkg.panelCount === 1
            ? t("solarPackages.labels.panelsCountOne")
            : t("solarPackages.labels.panelsCount", { count: pkg.panelCount })}
        </p>

        <div className="mt-6 flex-1" />

        <PackageCartControls
          productId={productId}
          packageSlug={pkg.id}
          locale={locale}
          requestHref={requestHref}
        />
      </div>
    </article>
  );
}

/** A grid of package cards. */
export function PackageGrid({
  packages,
  t,
  locale,
  productIdBySku,
}: {
  packages: readonly SolarPackage[];
  t: Translator["t"];
  locale: Locale;
  productIdBySku: Record<string, string>;
}) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((pkg) => (
        <li key={pkg.id} className="h-full">
          <PackageCard
            pkg={pkg}
            t={t}
            locale={locale}
            productId={productIdBySku[pkg.sku] ?? null}
          />
        </li>
      ))}
    </ul>
  );
}
