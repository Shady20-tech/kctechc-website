import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { PackageCard } from "@/components/solar/PackageCard";
import { PackageCartControls } from "@/components/solar/PackageCartControls";
import { ProductShowcase } from "@/components/content/ProductShowcase";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import {
  SOLAR_PACKAGES,
  findSolarPackage,
  findSolarPackageCategory,
  solarPackagesInCategory,
} from "@/lib/content/solar-packages";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/structured-data";
import { loadSolarPackageProductIds } from "@/lib/solar/package-products";
import { formatPrice } from "@/lib/store/types";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * One solar package.
 *
 * Driven entirely by the bundled brochure data, so the page is prerendered from
 * `generateStaticParams`. Prices, panels and the bill of materials are rendered
 * from the same values the card and the comparison table use, so the three
 * cannot disagree.
 *
 * "Add to cart" resolves the package to its seeded store product id; when the
 * product row is missing (an unseeded deployment) only request-info is offered,
 * rather than a cart action that would fail.
 */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    SOLAR_PACKAGES.map((pkg) => ({
      locale,
      department: "electrical-services",
      package: pkg.id,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; department: string; package: string }>;
}): Promise<Metadata> {
  const { locale, department, package: packageId } = await params;
  if (!isLocale(locale) || department !== "electrical-services") return {};
  const pkg = findSolarPackage(packageId);
  if (!pkg) return {};
  const t = createTranslator(locale).t;
  const name = t(`solarPackages.items.${pkg.id}.name`);
  const suitedFor = t(`solarPackages.items.${pkg.id}.suitedFor`);
  return buildMetadata({
    locale,
    pathWithoutLocale: `/electrical-services/packages/${pkg.id}`,
    title: `${name} — ${t("solarPackages.eyebrow")}`,
    description: `${name}. ${suitedFor}. ${t("solarPackages.pricingNote")}`,
  });
}

export default async function SolarPackageDetailPage({
  params,
}: {
  params: Promise<{ locale: string; department: string; package: string }>;
}) {
  const { locale, department, package: packageId } = await params;
  if (!isLocale(locale)) notFound();
  if (department !== "electrical-services") notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const pkg = findSolarPackage(packageId);
  if (!pkg) notFound();

  const category = findSolarPackageCategory(pkg.categoryId);
  if (!category) notFound();

  const name = t(`solarPackages.items.${pkg.id}.name`);
  const tag = t(`solarPackages.items.${pkg.id}.tag`);
  const suitedFor = t(`solarPackages.items.${pkg.id}.suitedFor`);
  const summary = t(`solarPackages.items.${pkg.id}.summary`);
  const alt = t(`solarPackages.items.${pkg.id}.alt`);

  const productIdBySku = await loadSolarPackageProductIds();
  const productId = productIdBySku[pkg.sku] ?? null;

  const packagePath = `/${resolved}/electrical-services/packages/${pkg.id}`;
  const requestHref = `/${resolved}/contact?department=electrical-services&package=${pkg.id}`;

  const related = solarPackagesInCategory(pkg.categoryId)
    .filter((entry) => entry.id !== pkg.id)
    .slice(0, 3);

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    {
      name: t("departments.electricalServices.label"),
      href: `/${resolved}/electrical-services`,
    },
    {
      name: t("solarPackages.heading"),
      href: `/${resolved}/electrical-services/packages`,
    },
    { name, href: packagePath },
  ];

  const costRows = [
    {
      label: t("solarPackages.labels.materials"),
      value: formatPrice(pkg.materialsMinor, "XAF", resolved),
    },
    {
      label: t("solarPackages.labels.accessoriesPercent", {
        percent: pkg.accessoriesPercent,
      }),
      value: formatPrice(pkg.accessoriesMinor, "XAF", resolved),
    },
    {
      label: t("solarPackages.labels.installationPercent", {
        percent: pkg.installationPercent,
      }),
      value: formatPrice(pkg.installationMinor, "XAF", resolved),
    },
    {
      label: t("solarPackages.labels.totalPrice"),
      value: formatPrice(pkg.priceMinor, "XAF", resolved),
    },
  ];

  return (
    <div {...departmentScopeProps("electrical-services")}>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          {
            name: t("departments.electricalServices.label"),
            path: `/${resolved}/electrical-services`,
          },
          {
            name: t("solarPackages.heading"),
            path: `/${resolved}/electrical-services/packages`,
          },
          { name, path: packagePath },
        ])}
      />
      <JsonLdScript
        data={productJsonLd({
          name,
          description: `${summary} ${t("solarPackages.pricingNote")}`,
          path: packagePath,
          locale: resolved,
          sku: pkg.sku,
          brand: "SAKO Power",
          priceMinor: pkg.priceMinor,
          currency: "XAF",
          availability: "in_stock",
          condition: "new",
        })}
      />

      <SectionBand labelledBy="package-heading">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-8"
        />

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="overflow-hidden rounded-card border border-border bg-surface-sunken">
            <div className="relative aspect-video">
              <Image
                src={pkg.image}
                alt={alt}
                fill
                sizes="(min-width: 1024px) 40rem, 100vw"
                priority
                className="object-cover"
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={pkg.highlighted ? "warning" : "neutral"}>
                {tag}
              </Badge>
              <Badge tone="neutral">
                {t(`solarPackages.categories.${pkg.categoryId}.name`)}
              </Badge>
            </div>

            <h1
              id="package-heading"
              className="display-tight mt-4 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
            >
              {name}
            </h1>
            <p className="mono-label mt-2 text-muted">{suitedFor}</p>

            <p className="mt-5 text-base leading-relaxed text-body">
              {summary}
            </p>

            <p className="mt-6 font-display text-3xl font-bold text-ink-900">
              {formatPrice(pkg.priceMinor, "XAF", resolved)}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t("solarPackages.labels.specPrice")}
            </p>

            <p className="mono-label mt-4 text-muted">
              {pkg.panelCount === 1
                ? t("solarPackages.labels.panelsCountOne")
                : t("solarPackages.labels.panelsCount", {
                    count: pkg.panelCount,
                  })}
            </p>

            <div className="mt-8">
              <PackageCartControls
                productId={productId}
                packageSlug={pkg.id}
                locale={resolved}
                requestHref={requestHref}
              />
            </div>
          </div>
        </div>
      </SectionBand>

      <SectionBand tone="alt" labelledBy="package-cost-heading">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2
              id="package-cost-heading"
              className="text-xl font-semibold text-ink-900 sm:text-2xl"
            >
              {t("solarPackages.labels.costBreakdownHeading")}
            </h2>
            <table className="mt-4 w-full text-sm">
              <caption className="visually-hidden">
                {t("solarPackages.labels.costBreakdownHeading")}
              </caption>
              <tbody>
                {costRows.map((row, index) => (
                  <tr
                    key={row.label}
                    className={`border-t border-border-strong${
                      index === costRows.length - 1 ? " font-semibold" : ""
                    }`}
                  >
                    <th
                      scope="row"
                      className="py-2 pr-2 text-left font-medium text-ink-900"
                    >
                      {row.label}
                    </th>
                    <td className="py-2 text-right tabular-nums text-ink-900">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-sm text-muted">
              {t("solarPackages.pricingNote")}
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink-900 sm:text-2xl">
              {t("solarPackages.labels.included")}
            </h2>
            <ul className="mt-4 space-y-3">
              {pkg.lines.map((line) => (
                <li key={line.key} className="flex gap-3 text-sm text-body">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dept-accent"
                  />
                  <span>
                    {line.quantity > 1 ? `${line.quantity} × ` : ""}
                    {t(line.key)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionBand>

      <ProductShowcase
        t={t}
        variant="grid"
        eyebrow={t("electricalProducts.eyebrow")}
        heading={t("electricalProducts.heading")}
        intro={t("electricalProducts.intro")}
        note={t("electricalProducts.note")}
        headingId="electrical-equipment-heading"
      />

      {related.length > 0 ? (
        <SectionBand labelledBy="package-related-heading">
          <h2
            id="package-related-heading"
            className="text-xl font-semibold text-ink-900 sm:text-2xl"
          >
            {t(`solarPackages.categories.${pkg.categoryId}.name`)}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((entry) => (
              <li key={entry.id} className="h-full">
                <PackageCard
                  pkg={entry}
                  t={t}
                  locale={resolved}
                  productId={productIdBySku[entry.sku] ?? null}
                />
              </li>
            ))}
          </ul>
        </SectionBand>
      ) : null}

      <div className="container-page section">
        <p>
          <Link
            href={`/${resolved}/electrical-services/packages`}
            className="text-sm font-semibold text-ink-900 underline underline-offset-4 transition-soft hover:text-dept-accent"
          >
            {t("solarPackages.labels.backToPackages")}
          </Link>
        </p>
      </div>
    </div>
  );
}
