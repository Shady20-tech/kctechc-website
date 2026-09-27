import { notFound } from "next/navigation";

import { CoverUploadForm } from "@/components/admin/CoverUploadForm";
import { InsightForm } from "@/components/admin/InsightForm";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireRole } from "@/lib/auth/guards";
import { ELEVATED_ROLES } from "@/lib/auth/roles";
import { updateInsightAction } from "@/lib/content/admin-actions";
import { getAdminInsight, loadContentOptions } from "@/lib/content/admin-queries";
import { createTranslator } from "@/lib/i18n/translator";
import { publicBucketUrl, CONTENT_MEDIA_BUCKET } from "@/lib/uploads/media";

export const dynamic = "force-dynamic";

/** Admin: edit an article and manage its cover image. */
export default async function AdminInsightEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([...ELEVATED_ROLES], "/admin/content");
  const { id } = await params;
  const t = createTranslator("en").t;

  const insight = await getAdminInsight(id);
  if (!insight) notFound();

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
    coverHeading: t("adminContent.coverHeading"),
    coverIntro: t("adminContent.coverIntro"),
    coverUpload: t("adminContent.coverUpload"),
    coverUploading: t("adminContent.coverUploading"),
    coverUpdated: t("adminContent.coverUpdated"),
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
        heading={t("adminContent.editHeading")}
        intro={insight.title}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <InsightForm
            action={updateInsightAction}
            id={insight.id}
            initial={{
              slug: insight.slug,
              title: insight.title,
              summary: insight.summary,
              body: insight.body,
              categoryId: insight.categoryId,
              departmentId: insight.departmentId,
              authorId: insight.authorId,
              isFeatured: insight.isFeatured,
              publishState: insight.publishState,
            }}
            options={options}
            labels={labels}
          />
        </Card>

        <Card>
          <CoverUploadForm
            id={insight.id}
            currentUrl={publicBucketUrl(CONTENT_MEDIA_BUCKET, insight.coverImagePath)}
            labels={labels}
          />
        </Card>
      </div>
    </>
  );
}
