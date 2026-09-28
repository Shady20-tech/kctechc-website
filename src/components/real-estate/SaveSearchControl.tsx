"use client";

import { BookmarkPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { saveSearchAction } from "@/lib/real-estate/customer-actions";
import type { ListingFilters } from "@/lib/real-estate/search";

/**
 * "Save this search" for the current filtered view.
 *
 * The control only appears once there is something worth saving — a search with no
 * filters is not a search, and a saved copy of the whole catalogue would be a
 * bookmark the browser already provides. The caller decides that and does not
 * render this component otherwise.
 *
 * The label is asked for inline rather than through a modal. A modal would trap
 * focus, need a dismissal path and a backdrop, and this is one text field and two
 * buttons; an expanding row keeps the interaction on the page the customer was
 * reading and keeps the saved search visibly connected to the filters above it.
 *
 * The query string handed to the action is the current filter state, which the
 * action normalizes before storing. Passing the raw `window.location.search` would
 * have been tempting but wrong: it carries the view and page parameters, and a
 * saved search that reopened on page 3 of a changed result set would be a bug the
 * customer would have to diagnose themselves.
 */
export function SaveSearchControl({
  locale,
  queryString,
  filters,
}: {
  locale: Locale;
  queryString: string;
  filters: ListingFilters;
}) {
  // The translator is built here rather than passed in: it is a closure over the
  // dictionary and cannot cross the Server/Client boundary, so a `t` prop would
  // compile and then fail at render.
  const t = createTranslator(locale).t;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A search with no filters is the whole catalogue, which the browser can already
  // bookmark. Nothing is offered for it.
  if (!queryString) return null;

  const suggested = suggestLabel(filters);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveSearchAction(label, queryString, locale);
      if (result.status === "unauthenticated") {
        router.push(
          `/admin/login?next=${encodeURIComponent(
            `/${locale}/real-estate/listings${queryString}`,
          )}`,
        );
        return;
      }
      if (result.status === "unconfigured") {
        setMessage(t("realEstate.savedSearches.errors.unconfigured"));
        return;
      }
      if (result.status === "error") {
        setMessage(t(`realEstate.savedSearches.errors.${result.message}`));
        return;
      }
      setOpen(false);
      setLabel("");
      setMessage(t("realEstate.savedSearches.saved"));
      router.refresh();
    });
  }

  return (
    <div>
      {open ? (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="saved-search-label"
              className="block text-sm font-medium text-ink-900"
            >
              {t("realEstate.savedSearches.labelField")}
            </label>
            <input
              id="saved-search-label"
              name="label"
              type="text"
              required
              maxLength={120}
              value={label}
              placeholder={suggested}
              onChange={(event) => setLabel(event.currentTarget.value)}
              className="mt-1.5 w-56 rounded-field border border-border bg-surface px-3 py-2 text-sm text-ink-900"
            />
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {t("realEstate.savedSearches.save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              setMessage(null);
            }}
          >
            {t("actions.cancel")}
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <BookmarkPlus aria-hidden="true" className="h-4 w-4" />
          {t("realEstate.savedSearches.saveThisSearch")}
        </Button>
      )}
      {message ? (
        <p role="status" className="mt-2 text-sm text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A default label drawn from the filters.
 *
 * Offered as the field's placeholder rather than pre-filled: a pre-filled value is
 * submitted if the customer types nothing, which is usually what they want, but
 * showing it as a suggestion means they are not fighting a value they did not
 * write. The suggestion is deliberately short — a region and a type, not all eight
 * filters.
 */
function suggestLabel(filters: ListingFilters): string {
  const parts: string[] = [];
  if (filters.listingType) parts.push(filters.listingType);
  if (filters.propertyKind) parts.push(filters.propertyKind);
  if (filters.regionSlug) parts.push(filters.regionSlug.replace(/-/g, " "));
  if (filters.query) parts.push(filters.query);
  return parts.join(" · ");
}
