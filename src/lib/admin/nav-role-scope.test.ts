import { describe, expect, it } from "vitest";
import { navItemsForRole } from "@/lib/admin/navigation";
import type { AppRole } from "@/lib/auth/roles";

describe("department console entries per role", () => {
  const hrefs = (role: AppRole) => navItemsForRole(role).map((i) => i.href);

  it("gives real_estate_staff the real-estate console but not another department's", () => {
    const h = hrefs("real_estate_staff");
    expect(h).toContain("/admin/real-estate");
    expect(h).not.toContain("/admin/digital-marketing");
    expect(h).not.toContain("/admin/electrical-services");
  });

  it("gives real_estate_admin the same front door", () => {
    expect(hrefs("real_estate_admin")).toContain("/admin/real-estate");
  });

  it("gives digital marketing staff their own console only", () => {
    const h = hrefs("digital_marketing_staff");
    expect(h).toContain("/admin/digital-marketing");
    expect(h).not.toContain("/admin/electrical-services");
    expect(h).not.toContain("/admin/real-estate");
  });

  it("gives electrical staff their own console only", () => {
    const h = hrefs("electrical_staff");
    expect(h).toContain("/admin/electrical-services");
    expect(h).not.toContain("/admin/digital-marketing");
    expect(h).not.toContain("/admin/real-estate");
  });

  it("gives a super admin every department console", () => {
    const h = hrefs("super_admin");
    expect(h).toContain("/admin/real-estate");
    expect(h).toContain("/admin/digital-marketing");
    expect(h).toContain("/admin/electrical-services");
  });

  it("keeps the portfolio manager away from the staff tier", () => {
    // The listing routes are the administrator's grant; the console front door is not.
    const staff = hrefs("real_estate_staff");
    expect(staff).not.toContain("/admin/real-estate/listings");
    expect(hrefs("real_estate_admin")).toContain("/admin/real-estate/listings");
  });
});
