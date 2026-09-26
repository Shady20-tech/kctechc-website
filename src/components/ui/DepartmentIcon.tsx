import { Building2, Megaphone, Zap, type LucideIcon } from "lucide-react";
import type { DepartmentSlug } from "@/lib/config/site";

/**
 * Department icons.
 *
 * Icons are decorative here — every one accompanies a visible department name —
 * so they are `aria-hidden` and never the sole label for a link.
 */
const ICONS: Record<DepartmentSlug, LucideIcon> = {
  "digital-marketing": Megaphone,
  "electrical-services": Zap,
  "real-estate": Building2,
};

export function DepartmentIcon({
  slug,
  className,
}: {
  slug: DepartmentSlug;
  className?: string;
}) {
  const Icon = ICONS[slug];
  return <Icon aria-hidden="true" className={className} />;
}
