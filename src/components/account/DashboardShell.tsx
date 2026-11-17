"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Building2,
  Heart,
  LayoutDashboard,
  Menu,
  PlusCircle,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { Avatar } from "@/components/admin/Avatar";
import { Button } from "@/components/ui/Button";
import { customerSignOutAction } from "@/lib/auth/customer-sign-out";
import type { DashboardKind } from "@/lib/real-estate/dashboard";
import {
  isDashboardNavActive,
  type DashboardNavIconKey,
  type DashboardNavSection,
} from "@/lib/real-estate/dashboard-nav";

/**
 * Resolves a dashboard nav entry's icon from its serializable key.
 *
 * The icons live here rather than in the nav model because this is the module that
 * renders them, and a key is the only form in which an icon can cross the
 * Server/Client boundary into a Client Component.
 */
const NAV_ICONS: Record<DashboardNavIconKey, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  create: PlusCircle,
  profile: Building2,
  favorites: Heart,
  savedSearches: Search,
  kyc: ShieldCheck,
  account: UserRound,
};

/**
 * The sidebar shell shared by the landlord and agent dashboards.
 *
 * A Client Component for the same two genuinely client-side reasons the admin
 * sidebar is one: it needs the current pathname to mark the active entry, and it
 * owns the mobile open/closed state. Everything else — the nav sections, the
 * labels and the viewer's own identity — is resolved on the server and passed in
 * already localized, so this component holds no authorization logic.
 *
 * It mirrors the admin console's shell deliberately: a customer who is also staff,
 * and a visitor who has seen the console, should find the two dashboards laid out
 * the same way. On desktop the sidebar is a fixed column; below `lg` it collapses
 * to a top bar with a disclosure button, because a persistent 16rem column on a
 * phone would leave no room for the listings these dashboards exist to show.
 *
 * The stacking rules are copied from the admin sidebar on purpose: the mobile bar
 * is `relative z-20`, the panel `z-10`, and the backdrop `z-0`. As a sibling at
 * the same `z` the backdrop (later in DOM order) would win the tie and swallow
 * every tap on a nav link.
 */
export function DashboardShell({
  sections,
  labels,
  user,
  locale,
  kind,
  children,
}: {
  sections: readonly DashboardNavSection[];
  /** Fully resolved labels, keyed by the nav entry's `labelKey` / `headingKey`. */
  labels: Record<string, string>;
  user: { name: string; email: string; role: string; avatarUrl: string | null };
  locale: string;
  kind: DashboardKind;
  children: ReactNode;
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
              const active = isDashboardNavActive(item, pathname);
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
    <div className="lg:flex lg:items-start">
      {/* Mobile bar. `relative z-20` keeps it above the drawer panel (`z-10`) and
          the backdrop (`z-0`) so the toggle stays tappable while the drawer is open. */}
      <div className="relative z-20 flex items-center justify-between border-b border-ink-700 bg-ink-950 px-4 py-3 lg:hidden">
        <p className="font-display text-base font-bold text-white">
          {labels.consoleName}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          aria-expanded={open}
          aria-controls="dashboard-sidebar"
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
      </div>

      <aside
        id="dashboard-sidebar"
        className={`${
          open
            ? "relative z-10 block max-h-[calc(100dvh-4rem)] overflow-y-auto"
            : "hidden"
        } bg-ink-950 lg:sticky lg:top-18 lg:z-auto lg:block lg:h-[calc(100dvh-4.5rem)] lg:max-h-none lg:w-64 lg:shrink-0 lg:overflow-y-auto`}
      >
        <div className="flex h-full flex-col p-4">
          <Link
            href={`/${locale}/account/${kind}`}
            className="hidden px-3 py-2 font-display text-lg font-bold text-white lg:block"
          >
            {labels.consoleName}
          </Link>

          <div className="mt-0 flex-1 lg:mt-6">{nav}</div>

          <div className="mt-6 space-y-3 border-t border-ink-700 pt-4">
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

            <Link
              href={`/${locale}/account`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium text-ink-200 transition-soft hover:bg-white/5 hover:text-white"
            >
              <UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{labels.yourAccount}</span>
            </Link>

            <form action={customerSignOutAction} className="px-1">
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="w-full rounded-control px-2 py-2 text-left text-sm font-medium text-ink-200 transition-soft hover:bg-white/5 hover:text-white"
              >
                {labels.signOut}
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Backdrop for the mobile drawer. `z-0` is deliberate: it covers the page
          behind the open drawer while the bar and the panel paint above it. */}
      {open ? (
        <button
          type="button"
          aria-label={labels.closeMenu}
          className="fixed inset-0 z-0 bg-ink-950/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
