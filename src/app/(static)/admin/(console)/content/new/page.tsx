import { InsightForm } from "@/components/admin/InsightForm";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireRole } from "@/lib/auth/guards";
import { CONTENT_MANAGER_ROLES } from "@/lib/auth/roles";
import { createInsightAction } from "@/lib/content/admin-actions";
import { loadContentOptions } from "@/lib/content/admin-queries";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/** Admin: write a new article. The cover image is added once the article exists. */
export default async function AdminNewInsightPage() {
  await requireRole([...CONTENT_MANAGER_ROLES], "/admin/content/new");
  const t = createTranslator("en").t;
  const options = await loadContentOptions();

  const labels: Record<string, string> = {
    slugLabel: t("adminContent.slugLabel"),
    slugHint: t("adminContent.slugHint"),
    titleLabel: t("adminContent.titleLabel"),
    summaryLabel: t("adminContent.summaryLabel"),
    summaryHint: t("adminContent.summaryHint"),
    bodyLabel: t("adminContent.bodyLabel"),
    categoryLabel: t("adminContent.categoryLabel"),
    departmentLabel: t("adminContent.departmentLabel"),
    authorLabel: t("adminContent.authorLabel"),
    featuredLabel: t("adminContent.featuredLabel"),
    stateLabel: t("adminContent.stateLabel"),
    save: t("adminContent.save"),
    saving: t("adminContent.saving"),
    created: t("adminContent.created"),
    updated: t("adminContent.updated"),
    "state.draft": t("adminContent.state.draft"),
    "state.published": t("adminContent.state.published"),
    "state.archived": t("adminContent.state.archived"),
  };
  for (const key of [
    "unauthenticated",
    "forbidden",
    "unconfigured",
    "invalid",
    "duplicate",
    "need_author",
    "write_failed",
    "not_found",
    "no_file",
    "empty",
    "too_large",
    "type_not_allowed",
    "unknown_type",
    "upload_failed",
    "update_failed",
  ]) {
    labels[`errors.${key}`] = t(`adminContent.errors.${key}`);
  }

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.content")}
        heading={t("adminContent.newHeading")}
        intro={t("adminContent.formIntro")}
      />
      <Card className="mt-8">
        <InsightForm action={createInsightAction} options={options} labels={labels} />
      </Card>
    </>
  );
}
