import { notFound } from "next/navigation";

import { AgentProfilePanel } from "@/components/account/AgentProfilePanel";
import { DashboardListingForm } from "@/components/account/DashboardListingForm";
import { DashboardMediaPanel } from "@/components/account/DashboardMediaPanel";
import { DashboardStatusPanel } from "@/components/account/DashboardStatusPanel";
import {
  DashboardCreateBody,
  DashboardDetailBody,
  DashboardOverview,
} from "@/components/account/DashboardViews";
import type { Locale } from "@/lib/i18n/locales";
import type { DashboardKind } from "@/lib/real-estate/dashboard";
import {
  loadDashboardListingById,
  loadDashboardListingMedia,
} from "@/lib/real-estate/dashboard-loaders";
import {
  requireAuthorisedDashboard,
  requireDashboardContext,
} from "@/lib/real-estate/dashboard-page";
import { loadGeographyOptions, loadListingPrivateDetails } from "@/lib/real-estate/loaders";
import { loadCameroonRegions } from "@/lib/real-estate/membership-loaders";

/**
 * The three dashboard page bodies, shared by the landlord and agent routes.
 *
 * These live outside `page.tsx` because a page module may only export the names
 * Next recognises; a helper exported from a route file fails the build's route
 * type check. Each route is then a few lines that call one of these with its
 * `kind`, so the two dashboards cannot drift apart.
 */

/**
 * A dashboard overview.
 *
 * The agent dashboard additionally renders the public-profile panel, which is the
 * one structural difference between the two. It arrives as a slot so the shared
 * component does not have to know about agents.
 */
export async function renderDashboardOverview(
  kind: DashboardKind,
  locale: Locale,
) {
  const context = await requireDashboardContext(kind, locale);

  if (kind !== "agent" || !context.authorised) {
    return <DashboardOverview context={context} locale={locale} />;
  }

  const regions = await loadCameroonRegions(locale);

  return (
    <DashboardOverview
      context={context}
      locale={locale}
      footer={
        <div className="mt-12">
          <AgentProfilePanel
            locale={locale}
            profile={context.agentProfile}
            regions={regions}
          />
        </div>
      }
    />
  );
}

/** The create-a-listing page. */
export async function renderDashboardCreate(
  kind: DashboardKind,
  locale: Locale,
) {
  await requireAuthorisedDashboard(kind, locale);
  const geography = await loadGeographyOptions();

  return (
    <DashboardCreateBody
      kind={kind}
      locale={locale}
      hasGeography={geography.length > 0}
      form={
        <DashboardListingForm kind={kind} locale={locale} geography={geography} />
      }
    />
  );
}

/**
 * The edit-a-listing page: the form, the status controls and the gallery.
 *
 * The listing is read through the session client, whose policies scope it to the
 * owner or manager, so an id belonging to another account returns null and the
 * route 404s rather than opening a form whose save the database would refuse. The
 * private details are read separately because they live in their own table behind
 * their own policy.
 */
export async function renderDashboardDetail(
  kind: DashboardKind,
  locale: Locale,
  listingId: string,
) {
  await requireAuthorisedDashboard(kind, locale);

  const [listing, geography] = await Promise.all([
    loadDashboardListingById(listingId),
    loadGeographyOptions(),
  ]);

  if (!listing) notFound();

  const [media, privateDetails] = await Promise.all([
    loadDashboardListingMedia(listing.id),
    loadListingPrivateDetails(listing.id),
  ]);

  return (
    <DashboardDetailBody kind={kind} locale={locale}>
      <DashboardStatusPanel kind={kind} locale={locale} listing={listing} />

      <DashboardListingForm
        kind={kind}
        locale={locale}
        geography={geography}
        listing={listing}
        privateDetails={privateDetails}
      />

      <DashboardMediaPanel
        kind={kind}
        locale={locale}
        listingId={listing.id}
        media={media}
      />
    </DashboardDetailBody>
  );
}
