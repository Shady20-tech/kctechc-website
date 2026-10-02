import "server-only";

import { canAccessDepartment, type AppRole } from "@/lib/auth/roles";
import { DEPARTMENTS, type DepartmentSlug } from "@/lib/config/site";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/database.types";

type PublishState = Database["public"]["Enums"]["publish_state"];
type PropertyType = Database["public"]["Enums"]["property_type"];
type MediaRole = Database["public"]["Enums"]["project_media_role"];

/**
 * Admin reads for completed work ("Work Done").
 *
 * Reads go through the cookie-bound client so the department-scoped RLS policies
 * from `20260101000042_department_project_editing.sql` are the boundary: the list
 * and the editor see exactly the departments the caller may author, and no more.
 * The console list additionally filters by the caller's editable departments, so a
 * published project from another department — which the public policy makes
 * world-readable — does not clutter a department's own console.
 */

export type EditableDepartment = {
  id: string;
  slug: DepartmentSlug;
  name: string;
};

export type AdminProjectRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publishState: PublishState;
  departmentSlug: string;
  departmentName: string;
  completedYear: number | null;
  mediaCount: number;
  updatedAt: string;
};

export type AdminProjectDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  scope: string | null;
  outcome: string | null;
  departmentId: string;
  departmentSlug: string;
  location: string | null;
  propertyType: PropertyType | null;
  completedYear: number | null;
  publishState: PublishState;
  serviceIds: string[];
  media: AdminProjectMedia[];
};

export type AdminProjectMedia = {
  id: string;
  storagePath: string;
  altText: string;
  caption: string | null;
  credit: string | null;
  role: MediaRole;
  position: number;
};

export type ProjectOptions = {
  departments: readonly { id: string; slug: string; label: string }[];
  services: readonly { id: string; label: string }[];
};

/**
 * The departments a role may author work for.
 *
 * Derived from the same `canAccessDepartment` predicate the RLS policy mirrors,
 * so the console never offers a department whose write the database would refuse.
 * Returns [] for a role with no department (e.g. a real-estate agent), which the
 * page renders as "not available" rather than an empty list of departments.
 */
export function departmentsForRole(role: AppRole): DepartmentSlug[] {
  return DEPARTMENTS.filter((entry) =>
    canAccessDepartment(role, entry.slug),
  ).map((entry) => entry.slug);
}

/** Load the department rows (id + name) for the slugs a role may edit. */
export async function loadEditableDepartments(
  role: AppRole,
): Promise<EditableDepartment[]> {
  const allowed = departmentsForRole(role);
  if (allowed.length === 0) return [];

  const supabase = await createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("departments")
    .select("id, slug, name")
    .in("slug", allowed)
    .order("sort_order", { ascending: true });

  if (!data) return [];

  return data
    .filter((row): row is typeof row & { slug: DepartmentSlug } =>
      (allowed as readonly string[]).includes(row.slug),
    )
    .map((row) => ({ id: row.id, slug: row.slug, name: row.name }));
}

type ProjectListRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publish_state: PublishState;
  completed_year: number | null;
  updated_at: string;
  departments: { slug: string; name: string } | null;
};

/** The work records the caller may author, newest first. */
export async function listAdminProjects(
  role: AppRole,
): Promise<AdminProjectRow[]> {
  const allowed = departmentsForRole(role);
  if (allowed.length === 0) return [];

  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("electrical_projects")
    .select(
      "id, slug, title, summary, publish_state, completed_year, updated_at, departments!inner(slug, name)",
    )
    .in("departments.slug", allowed)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  const rows = data as unknown as ProjectListRow[];
  const ids = rows.map((row) => row.id);

  // Media counts in one round trip, keyed by project id.
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: media } = await supabase
      .from("project_media")
      .select("project_id")
      .in("project_id", ids);
    for (const item of media ?? []) {
      counts.set(item.project_id, (counts.get(item.project_id) ?? 0) + 1);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    publishState: row.publish_state,
    departmentSlug: row.departments?.slug ?? "",
    departmentName: row.departments?.name ?? "",
    completedYear: row.completed_year,
    mediaCount: counts.get(row.id) ?? 0,
    updatedAt: row.updated_at,
  }));
}

/**
 * One work record, with its media and service links, for the editor.
 *
 * Scoped to the departments `role` may author. The public select policy makes
 * another department's published project readable to any signed-in user, so
 * without this filter a guessed id would open an edit form whose save the write
 * policy then refuses. Returning null here turns that into a 404, so the page and
 * the database agree about what the caller may edit.
 */
export async function getAdminProject(
  id: string,
  role: AppRole,
): Promise<AdminProjectDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: project } = await supabase
    .from("electrical_projects")
    .select(
      "id, slug, title, summary, description, scope, outcome, department_id, location, property_type, completed_year, publish_state, departments(slug)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) return null;

  const departmentSlug =
    (project.departments as { slug: string } | null)?.slug ?? "";
  if (!departmentsForRole(role).includes(departmentSlug as DepartmentSlug)) {
    return null;
  }

  const [{ data: media }, { data: links }] = await Promise.all([
    supabase
      .from("project_media")
      .select("id, storage_path, alt_text, caption, credit, role, position")
      .eq("project_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("electrical_project_services")
      .select("service_id")
      .eq("project_id", id),
  ]);

  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    description: project.description,
    scope: project.scope,
    outcome: project.outcome,
    departmentId: project.department_id,
    departmentSlug,
    location: project.location,
    propertyType: project.property_type,
    completedYear: project.completed_year,
    publishState: project.publish_state,
    serviceIds: (links ?? []).map((link) => link.service_id),
    media: (media ?? []).map((item) => ({
      id: item.id,
      storagePath: item.storage_path,
      altText: item.alt_text,
      caption: item.caption,
      credit: item.credit,
      role: item.role,
      position: item.position,
    })),
  };
}

/**
 * Options for the create form: the departments the role may author, and the
 * services available in those departments.
 *
 * Services are scoped to the editable departments so an editor cannot attach an
 * Electrical Services service to a Digital Marketing project — the join would be
 * meaningless and the public filter would then offer an option that returns
 * nothing.
 */
export async function loadProjectOptions(
  role: AppRole,
): Promise<ProjectOptions> {
  const departments = await loadEditableDepartments(role);
  if (departments.length === 0) {
    return { departments: [], services: [] };
  }

  const supabase = await createClient();
  if (!supabase) return { departments: [], services: [] };

  const { data: services } = await supabase
    .from("services")
    .select("id, title, department_id")
    .in(
      "department_id",
      departments.map((entry) => entry.id),
    )
    .order("sort_order", { ascending: true });

  return {
    departments: departments.map((entry) => ({
      id: entry.id,
      slug: entry.slug,
      label: entry.name,
    })),
    services: (services ?? []).map((service) => ({
      id: service.id,
      label: service.title,
    })),
  };
}
