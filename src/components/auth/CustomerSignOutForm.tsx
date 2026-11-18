import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { customerSignOutAction } from "@/lib/auth/customer-sign-out";

/**
 * Customer sign-out control.
 *
 * A server component, so it adds no client JavaScript: the form posts straight to
 * the Server Action and the browser follows the redirect the action issues. The
 * admin console's menu is a client component because it is a dropdown; these
 * pages only need the one button.
 *
 * It renders the shared `Button` rather than a bare text link so that signing out
 * reads as an action on a customer page. As underlined text beside a page of
 * cards it was easy to miss entirely, and the same control is the customer's only
 * way back to a signed-out state from their account, favourites, saved searches
 * and order history.
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
      <Button type="submit" variant="secondary" size="sm">
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {label}
      </Button>
    </form>
  );
}
