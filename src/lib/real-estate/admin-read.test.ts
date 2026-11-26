import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { navItemsForRole } from "@/lib/admin/navigation";
import { isRealEstateAdminRole } from "@/lib/auth/roles";

function source(path: string): string {
  return readFileSync(
    path.startsWith("/") ? path : join(process.cwd(), path),
    "utf8",
  );
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("Supabase server-key access", () => {
  it("reads the service-role variable only through the one resolver", () => {
    const offenders = filesUnder(join(process.cwd(), "src"))
      .filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"))
      .filter((path) => !path.endsWith(".test.ts"))
      .filter((path) => !path.endsWith("server-env.ts"))
      .filter((path) =>
        source(path).includes("process.env.SUPABASE_SERVICE_ROLE_KEY"),
      );

    expect(offenders).toEqual([]);
  });
});

describe("real-estate admin reads", () => {
  it("returns the real PostgREST detail instead of an empty list", () => {
    const loaders = source("src/lib/real-estate/loaders.ts");

    expect(loaders).toContain("describeSupabaseError");
    expect(loaders).toContain("loadGeographyOptionsResult");
    expect(loaders).toContain("loadAdminListingsResult");
    expect(loaders).toContain("loadAdminListingByIdResult");
    expect(loaders).toContain("loadRealEstateOverviewResult");
    expect(loaders).toContain("loadListingSubmissionsResult");
  });

  it("uses result loaders on the real-estate console pages", () => {
    const pages = [
      "src/app/(static)/admin/(console)/real-estate/page.tsx",
      "src/app/(static)/admin/(console)/real-estate/listings/page.tsx",
      "src/app/(static)/admin/(console)/real-estate/listings/new/page.tsx",
      "src/app/(static)/admin/(console)/real-estate/listings/[id]/page.tsx",
      "src/app/(static)/admin/(console)/real-estate/submissions/page.tsx",
      "src/app/(static)/admin/(console)/real-estate/memberships/page.tsx",
      "src/app/(static)/admin/(console)/real-estate/verification/page.tsx",
      "src/app/(static)/admin/(console)/real-estate/kyc/page.tsx",
    ];

    for (const page of pages) {
      expect(source(page)).toContain("Result");
    }
  });

  it("distinguishes empty geography from a failed read", () => {
    const page = source(
      "src/app/(static)/admin/(console)/real-estate/listings/new/page.tsx",
    );

    expect(page).toContain("errors.read_failed");
    expect(page).toContain("errors.geography_empty");
    expect(page).toContain("geographyResult.detail");
  });

  it("puts the Supabase message beside a failed listing write", () => {
    const actions = source("src/lib/real-estate/admin-actions.ts");
    expect(actions).toContain("detail: describeSupabaseError(error)");
  });
});

describe("super-admin real-estate access", () => {
  it("can administer listings without a real-estate staff or agent account", () => {
    expect(isRealEstateAdminRole("super_admin")).toBe(true);
    expect(navItemsForRole("super_admin").map((item) => item.href)).toContain(
      "/admin/real-estate/listings",
    );
  });
});
