import { Phone } from "lucide-react";
import { REAL_ESTATE_AGENT_PHONES } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Direct phone contacts for the Real Estate agents.
 *
 * Shown inside the Real Estate department subtree, where `data-department` has
 * already bound `--dept-accent`. Each number is a real `tel:` link and the row is
 * at least 44px tall, so it is usable on a phone.
 */
export function AgentContacts({
  locale,
  className = "",
}: {
  locale: Locale;
  className?: string;
}) {
  const t = createTranslator(locale).t;

  return (
    <aside
      aria-labelledby="real-estate-agents-heading"
      className={`rounded-card border border-border bg-surface p-7 shadow-card ${className}`}
    >
      <p className="mono-label text-dept-accent">
        {t("realEstate.agents.eyebrow")}
      </p>
      <h2
        id="real-estate-agents-heading"
        className="mt-2 text-lg font-semibold text-ink-900"
      >
        {t("realEstate.agents.heading")}
      </h2>
      <p className="mt-2 text-sm text-body">{t("realEstate.agents.body")}</p>
      <ul className="mt-4 flex flex-wrap gap-3">
        {REAL_ESTATE_AGENT_PHONES.map((phone) => (
          <li key={phone.tel}>
            <a
              href={`tel:${phone.tel}`}
              aria-label={`${t("realEstate.agents.callLabel")} ${phone.label}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink-900 transition-soft hover:bg-ink-50"
            >
              <Phone aria-hidden="true" className="h-4 w-4 text-muted" />
              <span>{phone.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
