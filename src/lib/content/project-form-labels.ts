import { createTranslator } from "@/lib/i18n/translator";

/**
 * Labels for the completed-work forms.
 *
 * The admin pages are Server Components and the forms are Client Components, so
 * the label strings are resolved on the server and passed down as a plain object.
 * This lives outside the page modules because a page may only export the
 * Next.js-recognised names, and outside the `"use server"` actions because such a
 * module may only export async functions.
 */
export function projectFormLabels(): Record<string, string> {
  const t = createTranslator("en").t;
  const labels: Record<string, string> = {
    slugLabel: t("adminWork.slugLabel"),
    slugHint: t("adminWork.slugHint"),
    titleLabel: t("adminWork.titleLabel"),
    summaryLabel: t("adminWork.summaryLabel"),
    summaryHint: t("adminWork.summaryHint"),
    descriptionLabel: t("adminWork.descriptionLabel"),
    scopeLabel: t("adminWork.scopeLabel"),
    outcomeLabel: t("adminWork.outcomeLabel"),
    departmentLabel: t("adminWork.departmentLabel"),
    locationLabel: t("adminWork.locationLabel"),
    locationHint: t("adminWork.locationHint"),
    propertyTypeLabel: t("adminWork.propertyTypeLabel"),
    completedYearLabel: t("adminWork.completedYearLabel"),
    servicesLabel: t("adminWork.servicesLabel"),
    servicesEmpty: t("adminWork.servicesEmpty"),
    stateLabel: t("adminWork.stateLabel"),
    save: t("adminWork.save"),
    saving: t("adminWork.saving"),
    created: t("adminWork.created"),
    updated: t("adminWork.updated"),
    "state.draft": t("adminWork.state.draft"),
    "state.published": t("adminWork.state.published"),
    "state.archived": t("adminWork.state.archived"),
    "propertyType.residential": t("adminWork.propertyType.residential"),
    "propertyType.commercial": t("adminWork.propertyType.commercial"),
    "propertyType.industrial": t("adminWork.propertyType.industrial"),
    mediaHeading: t("adminWork.mediaHeading"),
    mediaIntro: t("adminWork.mediaIntro"),
    mediaEmpty: t("adminWork.mediaEmpty"),
    mediaAdded: t("adminWork.mediaAdded"),
    mediaUpload: t("adminWork.mediaUpload"),
    mediaUploading: t("adminWork.mediaUploading"),
    mediaRemove: t("adminWork.mediaRemove"),
    altLabel: t("adminWork.altLabel"),
    altHint: t("adminWork.altHint"),
    captionLabel: t("adminWork.captionLabel"),
    creditLabel: t("adminWork.creditLabel"),
    roleLabel: t("adminWork.roleLabel"),
    "role.general": t("adminWork.role.general"),
    "role.before": t("adminWork.role.before"),
    "role.after": t("adminWork.role.after"),
  };

  for (const key of [
    "unauthenticated",
    "forbidden",
    "unconfigured",
    "invalid",
    "duplicate",
    "write_failed",
    "not_found",
    "no_file",
    "alt_required",
    "role_taken",
    "empty",
    "too_large",
    "type_not_allowed",
    "unknown_type",
    "upload_failed",
    "update_failed",
  ]) {
    labels[`errors.${key}`] = t(`adminWork.errors.${key}`);
  }

  return labels;
}
