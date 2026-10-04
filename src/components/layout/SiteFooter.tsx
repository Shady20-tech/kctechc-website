import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { DEPARTMENTS, type DepartmentSlug } from "@/lib/config/site";
import type { SiteContent } from "@/lib/config/site-content";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";

/**
 * Global site footer.
 *
 * Contact details and the motto come from `SiteContent`, which is loaded from
 * editable `site_settings` with the business brief as fallback — so an editor can
 * update them without a deploy and the values stay identical everywhere they
 * appear. Every column is a real `<nav>`/`<address>` so the structure is
 * conveyed, not just the visual layout.
 */
export function SiteFooter({
  locale,
  t,
  site,
  departmentLabels,
}: {
  locale: Locale;
  t: Translator["t"];
  site: SiteContent;
  departmentLabels: Record<DepartmentSlug, string>;
}) {
  const year = new Date().getFullYear();
  const { contact } = site;

  return (
    <footer
      aria-label={t("a11y.footerLandmark")}
      className="on-ink mt-16 border-t border-white/10 bg-ink-950 text-white"
    >
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo locale={locale} tone="light" showMotto={false} />
          <p className="mono-label mt-4 text-white/50">
            {t("footer.mottoLabel")}
          </p>
          <p className="mt-1 text-sm text-white/80">{site.motto}</p>
          <SocialLinks t={t} headingId="footer-social-heading" />
        </div>

        <nav aria-labelledby="footer-departments">
          <h2 id="footer-departments" className="mono-label text-accent-bright">
            {t("footer.departmentsHeading")}
          </h2>
          <ul className="mt-3 space-y-2">
            {DEPARTMENTS.map((department) => (
              <li key={department.slug}>
                <Link
                  href={`/${locale}/${department.slug}`}
                  className="inline-flex items-center gap-2 text-sm text-white/80 transition-soft hover:text-white"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: department.accent }}
                  />
                  {departmentLabels[department.slug]}
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="mono-label mt-8 text-accent-bright">
            {t("footer.company")}
          </h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link
                href={`/${locale}/about`}
                className="text-sm text-white/80 transition-soft hover:text-white"
              >
                {t("footer.aboutLink")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/contact`}
                className="text-sm text-white/80 transition-soft hover:text-white"
              >
                {t("footer.contactLink")}
              </Link>
            </li>
          </ul>
          <h2 id="footer-legal" className="mono-label mt-8 text-accent-bright">
            {t("footer.legalHeading")}
          </h2>
          <ul className="mt-3 space-y-2" aria-labelledby="footer-legal">
            <li>
              <Link
                href={`/${locale}/terms`}
                className="text-sm text-white/80 transition-soft hover:text-white"
              >
                {t("footer.terms")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/privacy`}
                className="text-sm text-white/80 transition-soft hover:text-white"
              >
                {t("footer.privacy")}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="mono-label text-accent-bright">
            {t("footer.contactHeading")}
          </h2>
          <ul className="mt-3 space-y-3 text-sm text-white/80">
            <li className="flex gap-2">
              <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex min-h-6 items-center transition-soft hover:text-white hover:underline"
              >
                {contact.email}
              </a>
            </li>
            <li className="flex gap-2">
              <Phone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex flex-col">
                {contact.phones.map((phone) => (
                  <a
                    key={phone}
                    href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                    /* `inline-flex` + `min-h-6` are load-bearing, not cosmetic.
                       A bare inline link measures 20px tall here, which is below
                       the 24px WCAG 2.2 target minimum, and two stacked phone
                       links are the worst case for that: a mis-tap dials the
                       wrong number. As a flex box with a 24px floor the target
                       clears the minimum through its own box rather than through
                       the generous-spacing exemption. */
                    className="inline-flex min-h-6 items-center transition-soft hover:text-white hover:underline"
                  >
                    {phone}
                  </a>
                ))}
              </span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mono-label text-accent-bright">
            {t("footer.officeHeading")}
          </h2>
          <address className="mt-3 flex gap-2 text-sm not-italic text-white/80">
            <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex flex-col">
              <span>{contact.address.street}</span>
              <span>{contact.address.city}</span>
              <span>{contact.address.region}</span>
              <span>{contact.address.country}</span>
            </span>
          </address>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/60">
            {t("footer.copyright", { year })}
          </p>
          <p className="text-xs text-white/60">{site.motto}</p>
        </div>
      </div>
    </footer>
  );
}
