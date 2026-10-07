import { ArrowRight } from "lucide-react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { PackageGrid } from "@/components/solar/PackageCard";
import { ProductShowcase } from "@/components/content/ProductShowcase";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ContactPrompt } from "@/components/ui/Cta";
import {
  SOLAR_PACKAGE_CATEGORIES,
  SOLAR_PACKAGES,
  solarPackagesInCategory,
} from "@/lib/content/solar-packages";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { loadSolarPackageProductIds } from "@/lib/solar/package-products";
import { formatPrice } from "@/lib/store/types";
import { departmentScopeProps } from "@/lib/theme/department-scope";
import { themeColorFor } from "@/lib/theme/department-theme";

/**
 * Electrical Services solar packages.
 *
 * The nine packages from the supplied brochure, grouped into the brochure's four
 * categories, with a comparison table. Every price is the brochure's own
 * (indicative) package figure and the page says so.
 *
 * Each package is also a real store product under the Electrical Services
 * department, so "Add to cart" routes through the existing, hardened cart and
 * order pipeline. "Request info" opens the contact form pre-tagged with the
 * department and the package, which is stored as an inquiry.
 *
 * All content is server-rendered from bundled data, so the page is prerendered
 * and works without JavaScript.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({
    locale,
    department: "electrical-services",
  }));
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: themeColorFor("electrical-services") };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}): Promise<Metadata> {
  const { locale, department } = await params;
  if (!isLocale(locale) || department !== "electrical-services") return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: "/electrical-services/packages",
    title: t("solarPackages.metaTitle"),
    description: t("solarPackages.metaDescription"),
  });
}

export default async function SolarPackagesPage({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}) {
  const { locale, department } = await params;
  if (!isLocale(locale)) notFound();
  // This surface belongs to the Electrical Services department; any other
  // department slug under `/packages` is a 404 rather than a duplicate page.
  if (department !== "electrical-services") notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const productIdBySku = await loadSolarPackageProductIds();

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
  ];

  const listJsonLd = itemListJsonLd({
    name: t("solarPackages.heading"),
    path: `/${resolved}/electrical-services/packages`,
    items: SOLAR_PACKAGES.map((pkg) => ({
      name: t(`solarPackages.items.${pkg.id}.name`),
      path: `/${resolved}/electrical-services/packages/${pkg.id}`,
    })),
  });

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
        ])}
      />
      {listJsonLd ? <JsonLdScript data={listJsonLd} /> : null}

      <section className="on-ink relative overflow-hidden bg-ink-950">
        <div className="relative container-page py-16 sm:py-20">
          <Breadcrumbs
            items={breadcrumbs}
            ariaLabel={t("a11y.breadcrumb")}
            tone="light"
            className="mb-8"
          />
          <div className="max-w-3xl">
            <p className="mono-label text-dept-accent">
              {t("solarPackages.eyebrow")}
            </p>
            <h1 className="display-tight mt-4 font-display text-4xl font-bold text-electric-300 sm:text-5xl">
              {t("solarPackages.heading")}
            </h1>
            <span aria-hidden="true" className="heading-rule" />
            <p className="mt-5 text-base leading-relaxed text-ink-200 sm:text-lg">
              {t("solarPackages.intro")}
            </p>
          </div>
        </div>
      </section>

      <SectionBand labelledBy="packages-comparison-heading">
        <p className="mono-label text-dept-accent">
          01 — {t("solarPackages.compareHeading")}
        </p>
        <h2
          id="packages-comparison-heading"
          className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
        >
          {t("solarPackages.compareHeading")}
        </h2>
        <span aria-hidden="true" className="heading-rule" />
        <p className="mt-4 max-w-2xl text-base text-body">
          {t("solarPackages.compareIntro")}
        </p>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="visually-hidden">
              {t("solarPackages.compareHeading")}
            </caption>
            <thead>
              <tr className="border-b border-border-strong text-left">
                <th
                  scope="col"
                  className="py-3 pr-4 font-semibold text-ink-900"
                >
                  {t("solarPackages.tableCategory")}
                </th>
                <th
                  scope="col"
                  className="py-3 pr-4 font-semibold text-ink-900"
                >
                  {t("solarPackages.tableSuitedFor")}
                </th>
                <th
                  scope="col"
                  className="py-3 pr-4 font-semibold text-ink-900"
                >
                  {t("solarPackages.tablePriceRange")}
                </th>
                <th
                  scope="col"
                  className="py-3 pr-4 font-semibold text-ink-900"
                >
                  {t("solarPackages.tablePanels")}
                </th>
              </tr>
            </thead>
            <tbody>
              {SOLAR_PACKAGE_CATEGORIES.map((category) => {
                const pkgs = solarPackagesInCategory(category.id);
                const prices = pkgs.map((pkg) => pkg.priceMinor);
                const minPanels = Math.min(
                  ...pkgs.map((pkg) => pkg.panelCount),
                );
                const maxPanels = Math.max(
                  ...pkgs.map((pkg) => pkg.panelCount),
                );
                return (
                  <tr
                    key={category.id}
                    className="border-b border-border align-top"
                  >
                    <th
                      scope="row"
                      className="py-3 pr-4 text-left font-medium text-ink-900"
                    >
                      {t(`solarPackages.categories.${category.id}.name`)}
                    </th>
                    <td className="py-3 pr-4 text-body">
                      {t(`solarPackages.categories.${category.id}.suitedFor`)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-body">
                      {formatPrice(Math.min(...prices), "XAF", resolved)} –{" "}
                      {formatPrice(Math.max(...prices), "XAF", resolved)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-body">
                      {minPanels === maxPanels
                        ? minPanels
                        : `${minPanels} – ${maxPanels}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm text-muted">
          {t("solarPackages.pricingNote")}
        </p>
      </SectionBand>

      {SOLAR_PACKAGE_CATEGORIES.map((category, index) => {
        const pkgs = solarPackagesInCategory(category.id);
        if (pkgs.length === 0) return null;
        const headingId = `packages-${category.slug}`;
        return (
          <SectionBand
            key={category.id}
            tone={index % 2 === 0 ? "alt" : "default"}
            labelledBy={headingId}
          >
            <p className="mono-label text-dept-accent">
              {String(index + 2).padStart(2, "0")} —{" "}
              {t(`solarPackages.categories.${category.id}.name`)}
            </p>
            <h2
              id={headingId}
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
            >
              {t(`solarPackages.categories.${category.id}.name`)}
            </h2>
            <span aria-hidden="true" className="heading-rule" />
            <p className="mt-4 max-w-2xl text-base text-body">
              {t(`solarPackages.categories.${category.id}.summary`)}
            </p>
            <div className="mt-8">
              <PackageGrid
                packages={pkgs}
                t={t}
                locale={resolved}
                productIdBySku={productIdBySku}
              />
            </div>
          </SectionBand>
        );
      })}

      <ProductShowcase
        t={t}
        variant="grid"
        eyebrow={t("electricalProducts.eyebrow")}
        heading={t("electricalProducts.heading")}
        intro={t("electricalProducts.intro")}
        note={t("electricalProducts.note")}
        headingId="electrical-equipment-heading"
      />

      <SectionBand tone="alt" labelledBy="packages-enterprise-heading">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2
              id="packages-enterprise-heading"
              className="display-tight font-display text-3xl font-bold text-ink-900"
            >
              {t("solarPackages.labels.enterpriseHeading")}
            </h2>
            <span aria-hidden="true" className="heading-rule" />
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-body">
              {t("solarPackages.labels.enterpriseBody")}
            </p>
            <p className="mt-6">
              <Link
                href={`/${resolved}/contact?department=electrical-services`}
                className="inline-flex items-center gap-2 rounded-control bg-dept-accent px-6 py-3 text-base font-semibold text-white transition-soft hover:opacity-90"
              >
                {t("solarPackages.labels.enterpriseCta")}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </p>
          </div>
          <div className="lg:col-span-1">
            <ContactPrompt
              locale={resolved}
              t={t}
              heading={t("contact.heading")}
              body={t("contact.intro")}
            />
          </div>
        </div>
      </SectionBand>
    </div>
  );
}
