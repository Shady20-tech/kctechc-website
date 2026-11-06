"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  FileText,
  Inbox,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";

import { Avatar } from "@/components/admin/Avatar";
import { Button } from "@/components/ui/Button";
import {
  isNavItemActive,
  type AdminNavIconKey,
  type AdminNavSectionClient,
} from "@/lib/admin/navigation";

/**
 * Resolves a nav entry's icon from its serializable key.
 *
 * The icons live here rather than in the nav model because this is the module that
 * actually renders them, and because a key is the only form in which an icon can
 * cross into a Client Component.
 */
const NAV_ICONS: Record<AdminNavIconKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  reports: BarChart3,
  crm: Inbox,
  orders: ShoppingCart,
  store: Package,
  work: Briefcase,
  listings: Building2,
  submissions: FileText,
  import: FileText,
  content: FileText,
  users: Users,
  logs: Activity,
  settings: Settings,
};

/**
 * The admin sidebar.
 *
 * A Client Component for two reasons that are genuinely client-side: it needs the
 * current pathname to mark the active entry, and it owns the mobile open/closed
 * state. Everything else is passed in already localized and already filtered to
 * the viewer's role, so this component never sees a link the user may not open —
 * the filtering happened on the server against the database role.
 *
 * On desktop the sidebar is a fixed column. Below `lg` it collapses to a top bar
 * with a disclosure button, because a persistent 16rem column on a phone would
 * leave no room for the content these dashboards exist to show.
 */
export function AdminSidebar({
  sections,
  labels,
  user,
  accountMenu,
}: {
  sections: readonly AdminNavSectionClient[];
  /** Fully resolved labels, keyed by the nav entry's `labelKey`. */
  labels: Record<string, string>;
  user: { name: string; email: string; role: string; avatarUrl: string | null };
  /**
   * The account menu, rendered by the layout so it is one component rather than
   * two. It sits in the mobile top bar beside the drawer toggle, mirroring the
   * desktop header, so a signed-in phone user can open their profile or sign out
   * in one tap instead of hunting inside the drawer.
   */
  accountMenu: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label={labels.sidebarLabel} className="space-y-6">
      {sections.map((section) => (
        <div key={section.headingKey}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-ink-300">
            {labels[section.headingKey]}
          </p>
          <ul className="mt-2 space-y-1">
            {section.items.map((item) => {
              const active = isNavItemActive(item.href, pathname);
              const Icon = NAV_ICONS[item.iconKey];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-soft ${
                      active
                        ? "bg-white/10 text-white"
                        : "text-ink-200 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>{labels[item.labelKey]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile bar. `relative z-20` keeps it, and the account dropdown it
          contains, above the drawer panel (`z-10`) and the backdrop (`z-0`), so
          the toggle, the avatar and every nav link stay tappable while the
          drawer is open. */}
      <div className="relative z-20 flex items-center justify-between border-b border-ink-700 bg-ink-950 px-4 py-3 lg:hidden">
        <p className="font-display text-base font-bold text-white">
          {labels.consoleName}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            aria-expanded={open}
            aria-controls="admin-sidebar"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
            <span className="visually-hidden">
              {open ? labels.closeMenu : labels.openMenu}
            </span>
          </Button>
          {/* Last, so the dropdown anchored to it opens flush with the bar's
              right edge rather than leaving the toggle's width as dead space —
              at 320px that difference is what keeps a 16rem panel on screen. */}
          {accountMenu}
        </div>
      </div>

      <aside
        id="admin-sidebar"
        className={`${
          open
            ? "relative z-10 block max-h-[calc(100dvh-4rem)] overflow-y-auto"
            : "hidden"
        } bg-ink-950 lg:sticky lg:top-0 lg:z-auto lg:block lg:h-screen lg:max-h-none lg:w-64 lg:shrink-0 lg:overflow-y-auto`}
      >
        <div className="flex h-full flex-col p-4">
          <Link
            href="/admin"
            className="hidden px-3 py-2 font-display text-lg font-bold text-white lg:block"
          >
            {labels.consoleName}
          </Link>

          <div className="mt-0 flex-1 lg:mt-6">{nav}</div>

          <div className="mt-6 border-t border-ink-700 pt-4">
            <div className="flex items-center gap-3 px-3">
              <Avatar
                src={user.avatarUrl}
                name={user.name || user.email}
                size="sm"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {user.name || user.email}
                </p>
                <p className="truncate text-xs text-ink-300">
                  {labels[`role.${user.role}`] ?? user.role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop for the mobile drawer.
          `z-0` is deliberate: it is a positive layer that covers the page
          content behind the open drawer, while the bar and the panel carry
          `z-10` so they paint above it. As a sibling at `z-10` it would tie with
          the panel, win on DOM order (it is later), and swallow every tap — the
          drawer closed and nothing navigated. */}
      {open ? (
        <button
          type="button"
          aria-label={labels.closeMenu}
          className="fixed inset-0 z-0 bg-ink-950/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
