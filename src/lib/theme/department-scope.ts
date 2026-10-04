import type { DepartmentSlug } from "@/lib/config/site";

/**
 * Department theming.
 *
 * The accent colour is applied by setting `data-department` on a subtree; the CSS
 * in `globals.css` maps that attribute to `--dept-accent`, which every shared
 * component reads. This keeps department identity contextual — the same button,
 * card and link render in the right accent with no parallel component variants
 * and no inline colour values in components.
 *
 * This helper is used by page wrappers *and* by individual department cards, so
 * it deliberately declares only the subtree accent. The document-level
 * micro-theme is not declared here: it is resolved from the route by the
 * bootstrap script and `ThemeController` and applied to `<html>`, which is the
 * only element that can theme the shared header and footer.
 */
export function departmentScopeProps(slug: DepartmentSlug): {
  "data-department": DepartmentSlug;
} {
  return { "data-department": slug };
}
