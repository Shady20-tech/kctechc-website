import { Home } from "lucide-react";
import Link from "next/link";

/**
 * The "view the main site" link that sits in the top bar of every signed-in
 * dashboard (the admin console and the landlord/agent dashboards).
 *
 * It is a plain link — no state, no session read — so it renders identically from
 * a Server Component and a Client Component. The `tone` picks the surface it sits
 * on: `ink` for the dark sidebar/mobile bar, `light` for the desktop top bar that
 * shares the page's light surface.
 *
 * `compact` drops the visible label and keeps only the home icon, for the narrow
 * mobile bar where the console name, this control, the drawer toggle and the
 * account menu share one row. The accessible name is carried by `aria-label`
 * there — with no visible text, nothing can mismatch it.
 */
export function ViewSiteLink({
  href,
  label,
  tone = "ink",
  compact = false,
  className,
}: {
  href: string;
  label: string;
  tone?: "ink" | "light";
  compact?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-sm font-medium transition-soft";
  const toneClass =
    tone === "ink"
      ? "text-ink-200 hover:bg-white/5 hover:text-white"
      : "border border-border bg-surface text-ink-900 hover:border-border-strong";

  return (
    <Link
      href={href}
      aria-label={compact ? label : undefined}
      className={[base, toneClass, className].filter(Boolean).join(" ")}
    >
      <Home aria-hidden="true" className="h-4 w-4 shrink-0" />
      {compact ? null : <span>{label}</span>}
    </Link>
  );
}
