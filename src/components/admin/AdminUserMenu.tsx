"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";

import { Avatar } from "@/components/admin/Avatar";
import { signOutAction } from "@/lib/auth/sign-out";

/**
 * Account menu for the admin top bar.
 *
 * Holds the profile link, the settings link and the sign-out control. Sign-out is
 * a form submitting a Server Action rather than a fetch, so the session cookies
 * are revoked on the server and the browser is redirected by the action — a
 * client-side `router.push` after clearing a cookie would leave the cookie in
 * place until the next request.
 *
 * The menu closes on outside click and on Escape. Both matter for keyboard users:
 * a menu that only closes by clicking its own button traps focus behind it.
 */
export function AdminUserMenu({
  name,
  email,
  avatarUrl,
  labels,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  labels: {
    openMenu: string;
    profile: string;
    settings: string;
    signOut: string;
    menuLabel: string;
    password: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.openMenu}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-pill border border-border bg-surface px-2 py-1.5 text-sm transition-soft hover:border-border-strong"
      >
        <Avatar src={avatarUrl} name={name || email} size="sm" />
        <span className="hidden max-w-40 truncate font-medium text-ink-900 sm:inline">
          {name || email}
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-card border border-border bg-surface shadow-lifted"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-900">
              {name || email}
            </p>
            <p className="truncate text-xs text-muted">{email}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">
              {labels.menuLabel}
            </p>
          </div>

          <Link
            role="menuitem"
            href="/admin/profile"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-900 hover:bg-surface-alt"
          >
            <UserRound aria-hidden="true" className="h-4 w-4" />
            {labels.profile}
          </Link>
          <Link
            role="menuitem"
            href="/admin/account/password"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-900 hover:bg-surface-alt"
          >
            <Settings aria-hidden="true" className="h-4 w-4" />
            {labels.password}
          </Link>
          <Link
            role="menuitem"
            href="/admin/settings"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-900 hover:bg-surface-alt"
          >
            <Settings aria-hidden="true" className="h-4 w-4" />
            {labels.settings}
          </Link>

          <form action={signOutAction} className="border-t border-border">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              {labels.signOut}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
