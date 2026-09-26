import type { DepartmentSlug } from "@/lib/config/site";

/**
 * Department theming.
 *
 * The accent colour is applied by setting `data-department` on a subtree; the
 * CSS in `globals.css` maps that attribute to `--dept-accent`, which every shared
 * component reads. This keeps department identity contextual — the same button,
 * card and link render in the right accent with no parallel component variants
 * and no inline colour values in components.
 */
export function departmentScopeProps(slug: DepartmentSlug): {
  "data-department": DepartmentSlug;
} {
  return { "data-department": slug };
}
