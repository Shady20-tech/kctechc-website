import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { SectionBand } from "@/components/layout/PageShell";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import {
  INSIGHTS_PATH,
  PROPERTY_SEARCH_PATH,
  SOLAR_PACKAGES_PATH,
  STORE_PATH,
} from "@/lib/config/navigation";
import { DEPARTMENTS } from "@/lib/config/site";
import { departmentHasServices } from "@/lib/content/defaults";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Site index: every public destination on one page.
 *
 * The corporate gateway and the localized home are the two places a visitor is
 * most likely to be deciding where to go, so this section lists the whole public
 * surface rather than only the primary nav. Each department card carries its own
 * sub-surfaces (services, portfolio, store, listings) so the index is genuinely
 * exhaustive and not a second copy of the header.
 *
 * The department sub-links are gated on the same predicate the routes themselves
 * use (`departmentHasServices`), so the index cannot advertise a URL that a
 * department does not yet serve. The store and the property search are gated on
 * the department that owns them for the same reason.
 */

type IndexLink = { href: string; label: string };

export function SiteIndex({
  locale,
  t,
  eyebrow,
  heading,
  intro,
  tone = "default",
  id = "site-index",
}: {
  locale: Locale;
  t: Translator["t"];
  eyebrow: string;
  heading: string;
  intro?: string;
  tone?: "default" | "alt" | "accent";
  id?: string;
}) {
  const companyLinks: IndexLink[] = [
    { href: `/${locale}/about`, label: t("nav.aboutUs") },
    { href: `/${locale}/services`, label: t("nav.services") },
    { href: `/${locale}/gallery`, label: t("nav.gallery") },
    { href: `/${locale}${INSIGHTS_PATH}`, label: t("nav.insights") },
    { href: `/${locale}/contact`, label: t("nav.contact") },
    { href: `/${locale}${STORE_PATH}`, label: t("nav.store") },
    {
      href: `/${locale}${PROPERTY_SEARCH_PATH}`,
      label: t("realEstate.browseHeading"),
    },
  ];

  const legalLinks: IndexLink[] = [
    { href: `/${locale}/terms`, label: t("footer.terms") },
    { href: `/${locale}/privacy`, label: t("footer.privacy") },
  ];

  const departmentLinks = (
    department: (typeof DEPARTMENTS)[number],
  ): IndexLink[] => {
    const slug = department.slug;
    const links: IndexLink[] = [
      { href: `/${locale}/${slug}`, label: t("nav.home") },
    ];
    // Same predicate the routes use, so the index never advertises a department
    // sub-surface that has not landed yet. The "Work Done" projects surface is
    // gated on it too — a department without services has no projects route.
    if (departmentHasServices(slug)) {
      links.push({
        href: `/${locale}/${slug}/services`,
        label: t("nav.services"),
      });
      links.push({
        href: `/${locale}/${slug}/projects`,
        label: t("projects.heading"),
      });
      links.push({
        href: `/${locale}/${slug}/portfolio`,
        label: t("portfolio.heading"),
      });
    }
    if (slug === "digital-marketing") {
      links.push({ href: `/${locale}${STORE_PATH}`, label: t("nav.store") });
    }
    if (slug === "real-estate") {
      links.push({
        href: `/${locale}${PROPERTY_SEARCH_PATH}`,
        label: t("realEstate.browseHeading"),
      });
    }
    // The solar-packages catalogue belongs to the Electrical Services
    // department, so it is listed only there — the same gating the routes use.
    if (slug === "electrical-services") {
      links.push({
        href: `/${locale}${SOLAR_PACKAGES_PATH}`,
        label: t("nav.packages"),
      });
    }
    return links;
  };

  return (
    <SectionBand tone={tone} id={id} labelledBy={`${id}-heading`}>
      <ScrollReveal className="max-w-2xl">
        <p className="mono-label text-dept-accent">{eyebrow}</p>
        <h2
          id={`${id}-heading`}
          className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
        >
          {heading}
        </h2>
        {intro ? <p className="mt-4 text-base text-body">{intro}</p> : null}
      </ScrollReveal>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((department) => (
          <nav
            key={department.slug}
            aria-labelledby={`${id}-${department.slug}`}
            // `card-edge` and the link hover colour both read `--dept-accent`, so
            // the card must carry its own `data-department` scope. Without it the
            // rail falls back to corporate teal for every department — the accent
            // is contextual and a subtree that forgets the attribute fails
            // silently rather than erroring.
            {...departmentScopeProps(department.slug)}
            className="card-edge rounded-card border border-border bg-surface p-6 shadow-card"
          >
            <h3
              id={`${id}-${department.slug}`}
              className="font-display text-base font-bold text-ink-900"
            >
              {t(department.labelKey)}
            </h3>
            <ul className="mt-4 space-y-2">
              {departmentLinks(department).map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-700 underline underline-offset-4 transition-soft hover:text-dept-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <nav
          aria-labelledby={`${id}-company`}
          className="rounded-card border border-border bg-surface p-6 shadow-card"
        >
          <h3
            id={`${id}-company`}
            className="font-display text-base font-bold text-ink-900"
          >
            {t("footer.company")}
          </h3>
          <ul className="mt-4 space-y-2">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex items-center gap-1 text-sm text-ink-700 underline underline-offset-4 transition-soft hover:text-dept-accent"
                >
                  {link.label}
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav
          aria-labelledby={`${id}-legal`}
          className="rounded-card border border-border bg-surface p-6 shadow-card"
        >
          <h3
            id={`${id}-legal`}
            className="font-display text-base font-bold text-ink-900"
          >
            {t("footer.legalHeading")}
          </h3>
          <ul className="mt-4 space-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-ink-700 underline underline-offset-4 transition-soft hover:text-dept-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </SectionBand>
  );
}
