import { customerSignOutAction } from "@/lib/auth/customer-sign-out";

/**
 * Customer sign-out control.
 *
 * A server component, so it adds no client JavaScript: the form posts straight to
 * the Server Action and the browser follows the redirect the action issues. The
 * admin console's menu is a client component because it is a dropdown; these
 * pages only need the one button.
 *
 * Rendered only for a signed-in visitor by the pages that use it — there is no
 * point offering sign-out to someone with no session.
 */
export function CustomerSignOutForm({
  locale,
  label,
}: {
  locale: string;
  label: string;
}) {
  return (
    <form action={customerSignOutAction}>
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        className="text-sm font-medium text-ink-900 underline underline-offset-4 hover:text-dept-accent"
      >
        {label}
      </button>
    </form>
  );
}
