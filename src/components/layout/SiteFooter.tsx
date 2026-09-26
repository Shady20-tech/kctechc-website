import Link from "next/link";
import { DEPARTMENTS, SITE } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";

/**
 * Site footer. Contact details render from the shared SITE constant so the
 * office address, phones and email stay identical everywhere they appear.
 */
export function SiteFooter({
  locale,
  t,
}: {
  locale: Locale;
  t: Translator["t"];
}) {
  const year = new Date().getFullYear();

  return (
    <footer
      aria-label={t("a11y.footerLandmark")}
      className="mt-16 border-t border-border bg-surface-alt"
    >
      <div className="container-page grid gap-8 py-12 md:grid-cols-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-900">
            {t("footer.company")}
          </h2>
          <p className="mt-3 text-sm text-body">{SITE.legalName}</p>
          <p className="mt-2 text-sm text-muted">{SITE.motto}</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-900">
            {t("footer.departmentsHeading")}
          </h2>
          <ul className="mt-3 space-y-2">
            {DEPARTMENTS.map((department) => (
              <li key={department.slug}>
                <Link
                  href={`/${locale}/${department.slug}`}
                  className="text-sm text-body hover:text-navy-900"
                >
                  {t(department.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-900">
            {t("footer.contactHeading")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-body">
            <li>
              <span className="block text-xs uppercase text-muted">
                {t("footer.emailLabel")}
              </span>
              <a href={`mailto:${SITE.email}`} className="hover:text-navy-900">
                {SITE.email}
              </a>
            </li>
            <li>
              <span className="block text-xs uppercase text-muted">
                {t("footer.phoneLabel")}
              </span>
              {SITE.phones.map((phone) => (
                <a
                  key={phone}
                  href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                  className="block hover:text-navy-900"
                >
                  {phone}
                </a>
              ))}
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-900">
            {t("footer.officeHeading")}
          </h2>
          <address className="mt-3 text-sm not-italic text-body">
            <span className="block">{SITE.address.street}</span>
            <span className="block">{SITE.address.city}</span>
            <span className="block">{SITE.address.region}</span>
            <span className="block">{SITE.address.country}</span>
          </address>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-page py-6">
          <p className="text-xs text-muted">
            {t("footer.copyright", { year })}
          </p>
        </div>
      </div>
    </footer>
  );
}
