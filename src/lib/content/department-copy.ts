import type { DepartmentSlug } from "@/lib/config/site";

/**
 * Department copy namespaces.
 *
 * The department home, services index and service detail routes are shared
 * between departments, so their headings, process, commitments and FAQ are
 * looked up through a namespace chosen from the department slug rather than
 * hard-coded to one department's keys.
 *
 * Digital Marketing shipped first with its copy under `dm.*`; Electrical
 * Services supplies its own under `el.*`. The keys within each namespace are the
 * same set, which is what lets one route component render either department. A
 * department absent from this map has no published copy and its routes 404, so
 * there is no silent fallback to another department's wording.
 */
const DEPARTMENT_COPY_PREFIX: Partial<Record<DepartmentSlug, string>> = {
  "digital-marketing": "dm",
  "electrical-services": "el",
};

/**
 * The message namespace for a department's shared-route copy.
 *
 * Returns null when the department has no copy, which callers treat as "this
 * department has no surface yet" rather than defaulting to another department's
 * text. Rendering Digital Marketing's process steps under Electrical Services
 * would be a factual claim about how the wrong department works.
 */
export function departmentCopyPrefix(
  department: DepartmentSlug,
): string | null {
  return DEPARTMENT_COPY_PREFIX[department] ?? null;
}
