import { notFound } from "next/navigation";

import { ProjectForm } from "@/components/admin/ProjectForm";
import { ProjectMediaForm } from "@/components/admin/ProjectMediaForm";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireRole } from "@/lib/auth/guards";
import { DEPARTMENT_EDITOR_ROLES } from "@/lib/auth/roles";
import { updateProjectAction } from "@/lib/content/project-admin-actions";
import {
  getAdminProject,
  loadProjectOptions,
} from "@/lib/content/project-admin-queries";
import { projectFormLabels } from "@/lib/content/project-form-labels";
import { createTranslator } from "@/lib/i18n/translator";
import { projectMediaPublicUrl } from "@/lib/uploads/storage";

export const dynamic = "force-dynamic";

/**
 * Admin: edit a finished job and manage its photography.
 *
 * The record is loaded through the department-scoped RLS policy, so a project
 * belonging to a department the caller may not edit simply is not there and the
 * route 404s — the guard and the database agree by construction.
 */
export default async function AdminWorkEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole(
    [...DEPARTMENT_EDITOR_ROLES],
    "/admin/work",
  );
  const { id } = await params;
  const t = createTranslator("en").t;

  const project = await getAdminProject(id, profile.role);
  if (!project) notFound();

  const options = await loadProjectOptions(profile.role);
  const labels = projectFormLabels();

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.work")}
        heading={t("adminWork.editHeading")}
        intro={project.title}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <ProjectForm
            action={updateProjectAction}
            id={project.id}
            departments={options.departments}
            services={options.services}
            initial={{
              slug: project.slug,
              title: project.title,
              summary: project.summary,
              description: project.description,
              scope: project.scope,
              outcome: project.outcome,
              departmentId: project.departmentId,
              location: project.location,
              propertyType: project.propertyType,
              completedYear: project.completedYear,
              publishState: project.publishState,
              serviceIds: project.serviceIds,
            }}
            labels={labels}
          />
        </Card>

        <Card>
          <ProjectMediaForm
            projectId={project.id}
            media={project.media.map((item) => ({
              id: item.id,
              url: projectMediaPublicUrl(item.storagePath),
              altText: item.altText,
              caption: item.caption,
              role: item.role,
            }))}
            labels={labels}
          />
        </Card>
      </div>
    </>
  );
}
