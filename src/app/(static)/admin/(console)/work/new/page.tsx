import { ProjectForm } from "@/components/admin/ProjectForm";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireRole } from "@/lib/auth/guards";
import { DEPARTMENT_EDITOR_ROLES } from "@/lib/auth/roles";
import { createProjectAction } from "@/lib/content/project-admin-actions";
import { loadProjectOptions } from "@/lib/content/project-admin-queries";
import { projectFormLabels } from "@/lib/content/project-form-labels";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Admin: record a finished job.
 *
 * The record is created as a draft first and photography is added on the edit
 * page, so the workflow is "create, add images, publish" rather than a single form
 * that has to hold a file upload and a new row at once. A role with no department
 * to edit — a real-estate agent — sees an explicit notice instead of a form whose
 * department select would have no options.
 */
export default async function AdminNewWorkPage() {
  const profile = await requireRole(
    [...DEPARTMENT_EDITOR_ROLES],
    "/admin/work/new",
  );
  const t = createTranslator("en").t;
  const options = await loadProjectOptions(profile.role);

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.work")}
        heading={t("adminWork.newHeading")}
        intro={t("adminWork.formIntro")}
      />
      <div className="mt-8">
        {options.departments.length === 0 ? (
          <Notice tone="warning" title={t("adminWork.noDepartmentHeading")}>
            <p>{t("adminWork.noDepartmentBody")}</p>
          </Notice>
        ) : (
          <Card>
            <ProjectForm
              action={createProjectAction}
              departments={options.departments}
              services={options.services}
              labels={projectFormLabels()}
            />
          </Card>
        )}
      </div>
    </>
  );
}
