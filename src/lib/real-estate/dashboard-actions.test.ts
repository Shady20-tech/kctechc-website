import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The dashboard Server Actions are the landlord/agent write path, and the tests
 * that matter are the boundaries rather than the happy path:
 *
 *  * a caller with no approved capability is refused before any write, and an
 *    approved agent with no `agent_profiles` row is refused distinctly (the fix is
 *    a staff action, not something the agent can do);
 *  * a created listing is ALWAYS a draft and never carries a `source` — the
 *    trigger pins it to `owner_submission`, and sending it here would be the
 *    second place that decides it (the exact shape of the self-publish hole);
 *  * an owner may only make the transitions `OWNER_SETTABLE_TRANSITIONS` allows,
 *    so a publish attempt is refused rather than left to the trigger.
 *
 * The session client is stubbed; the code under test is the real gating and
 * column-building logic.
 */

const getAuthState = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthState: () => getAuthState() }));

const loadMyMembershipSummary = vi.fn();
vi.mock("./membership-loaders", () => ({
  loadMyMembershipSummary: () => loadMyMembershipSummary(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const recordAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/security/audit", () => ({ recordAudit: (...a: unknown[]) => recordAudit(...a) }));

const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

import {
  createDashboardListingAction,
  setListingStatusAction,
  submitListingForReviewAction,
  updateDashboardListingAction,
} from "./dashboard-actions";

const AUTH = {
  status: "authenticated" as const,
  userId: "u-owner",
  email: "owner@example.com",
  profile: { id: "u-owner", fullName: "Owner Name", phone: "+237600000000" },
};

const ACTIVE_LANDLORD = [
  {
    type: "landlord" as const,
    status: "approved" as const,
    canApply: false,
    canReapply: false,
    isActive: true,
    reviewNotes: null,
    suspendedAt: null,
    suspensionReason: null,
  },
];

/** A form that satisfies `listingInputSchema` for a landlord listing. */
function validForm(overrides: Record<string, string> = {}): FormData {
  const fields: Record<string, string> = {
    title: "Three bedroom house in Limbe",
    slug: "three-bedroom-house-limbe",
    description: "A well kept family home near the market with a fenced yard.",
    listingType: "sale",
    propertyKind: "house",
    propertyType: "residential",
    regionId: "11111111-1111-4111-8111-111111111111",
    divisionId: "",
    subdivisionId: "",
    locality: "Limbe",
    highlights: "",
    amenities: "",
    price: "45000000",
    pricePeriod: "total",
    priceOnRequest: "",
    landAreaSqm: "",
    buildingAreaSqm: "180",
    bedrooms: "3",
    bathrooms: "2",
    yearBuilt: "",
    longitude: "",
    latitude: "",
    exactAddress: "",
    ownerName: "",
    ownerPhone: "",
    ownerEmail: "",
    internalNotes: "",
    ...overrides,
  };
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

type Captured = {
  inserted: Record<string, unknown>[];
  updated: Record<string, unknown>[];
};

/**
 * Build a session-client stub and install it as the module's `createClient`.
 *
 * `agentProfile` decides what the `agent_profiles` lookup returns (null models an
 * approved agent with no record). `insertResult` / `updateResult` / `selectResult`
 * drive the listing write paths.
 */
function stubSession(
  options: {
    agentProfile?: { id: string } | null;
    insertResult?: { data: unknown; error: unknown };
    updateResult?: { data: unknown; error: unknown };
    selectResult?: { data: unknown };
  } = {},
): Captured {
  const captured: Captured = { inserted: [], updated: [] };

  const client = {
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn((table: string) => {
      if (table === "agent_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: options.agentProfile ?? null }),
            }),
          }),
        };
      }
      if (table === "property_listings") {
        return {
          insert: (row: Record<string, unknown>) => {
            captured.inserted.push(row);
            return {
              select: () => ({
                single: async () =>
                  options.insertResult ?? { data: { id: "listing-1" }, error: null },
              }),
            };
          },
          update: (row: Record<string, unknown>) => {
            captured.updated.push(row);
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: async () =>
                    options.updateResult ?? { data: { id: "listing-1" }, error: null },
                }),
              }),
            };
          },
          select: () => ({
            eq: () => ({
              maybeSingle: async () => options.selectResult ?? { data: null },
            }),
          }),
        };
      }
      if (table === "listing_submissions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null }) }),
            }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      };
    }),
  };

  createClient.mockResolvedValue(client);
  // The action reads slug uniqueness through the service-role client. Reuse the
  // same stub so the test exercises the real query path rather than a second mock.
  createAdminClient.mockReturnValue({
    ...client,
    storage: { from: vi.fn() },
  });
  return captured;
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthState.mockResolvedValue(AUTH);
  loadMyMembershipSummary.mockResolvedValue(ACTIVE_LANDLORD);
  createAdminClient.mockReturnValue({ storage: { from: vi.fn() } });
});

describe("capability gating", () => {
  it("refuses a caller with no approved capability", async () => {
    loadMyMembershipSummary.mockResolvedValue([
      { ...ACTIVE_LANDLORD[0], status: "pending_review", isActive: false },
    ]);
    const result = await createDashboardListingAction("landlord", validForm());
    expect(result).toEqual({ ok: false, error: "capability_required" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    getAuthState.mockResolvedValue({ status: "unauthenticated" });
    const result = await createDashboardListingAction("landlord", validForm());
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("refuses an approved agent who has no agent profile, distinctly", async () => {
    // The fix is a staff action (create the agent record), so the message must not
    // be the generic "apply first".
    loadMyMembershipSummary.mockResolvedValue([{ ...ACTIVE_LANDLORD[0], type: "agent" }]);
    stubSession({ agentProfile: null });
    const result = await createDashboardListingAction("agent", validForm());
    expect(result).toEqual({ ok: false, error: "agent_profile_missing" });
  });
});

describe("createDashboardListingAction", () => {
  it("always creates a draft", async () => {
    const { inserted } = stubSession();
    const result = await createDashboardListingAction("landlord", validForm());
    expect(result.ok).toBe(true);
    expect(inserted[0]!.status).toBe("draft");
  });

  it("derives the URL slug from the title when the form posts none", async () => {
    const { inserted } = stubSession();
    const result = await createDashboardListingAction("landlord", validForm({ title: "Three bedroom house in Limbe", slug: "" }));
    expect(result.ok).toBe(true);
    expect(inserted[0]!.slug).toBe("three-bedroom-house-in-limbe");
  });

  it("never sends a source, so the trigger owns it", async () => {
    // Sending `source` here would be the second place that decides it, which is
    // the exact shape of the self-publish hole the trigger closed.
    const { inserted } = stubSession();
    await createDashboardListingAction("landlord", validForm());
    expect(inserted[0]).not.toHaveProperty("source");
  });

  it("assigns a landlord as owner and leaves the agent columns null", async () => {
    const { inserted } = stubSession();
    await createDashboardListingAction("landlord", validForm());
    expect(inserted[0]).toMatchObject({
      owner_id: "u-owner",
      managed_by: null,
      agent_id: null,
    });
  });

  it("assigns an agent as manager and poster, with no owner", async () => {
    loadMyMembershipSummary.mockResolvedValue([{ ...ACTIVE_LANDLORD[0], type: "agent" }]);
    const { inserted } = stubSession({ agentProfile: { id: "agent-1" } });
    await createDashboardListingAction("agent", validForm());
    expect(inserted[0]).toMatchObject({
      owner_id: null,
      managed_by: "u-owner",
      agent_id: "agent-1",
    });
  });

  it("refuses an invalid form before any write", async () => {
    const { inserted } = stubSession();
    const result = await createDashboardListingAction("landlord", validForm({ title: "" }));
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    expect(inserted).toHaveLength(0);
  });

  it("reports a duplicate slug distinctly", async () => {
    stubSession({
      insertResult: {
        data: null,
        error: { message: "duplicate key value violates unique constraint on slug" },
      },
    });
    const result = await createDashboardListingAction("landlord", validForm());
    expect(result).toMatchObject({ ok: false, error: "duplicate" });
  });

  it("records an audit entry on success", async () => {
    stubSession();
    await createDashboardListingAction("landlord", validForm());
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "listing_created", entityType: "property_listing" }),
    );
  });
});

describe("updateDashboardListingAction", () => {
  it("reports not_found when the row is not visible to the caller", async () => {
    // No ownership predicate is added: the policies scope the row, so another
    // account's listing matches zero rows. Telling "not yours" apart from "does
    // not exist" would confirm the row exists.
    stubSession({ updateResult: { data: null, error: null } });
    const result = await updateDashboardListingAction("landlord", "someone-elses", validForm());
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("never sends a source or a status on update", async () => {
    const { updated } = stubSession();
    await updateDashboardListingAction("landlord", "listing-1", validForm());
    expect(updated[0]).not.toHaveProperty("source");
    expect(updated[0]).not.toHaveProperty("status");
  });
});

describe("setListingStatusAction", () => {
  it("refuses a transition the owner may not make", async () => {
    // Publication is the reviewer's decision; the trigger would refuse it, so the
    // action must not offer it as if it were possible.
    stubSession({ selectResult: { data: { id: "listing-1", status: "draft", slug: "s" } } });
    const result = await setListingStatusAction("landlord", "listing-1", "published");
    expect(result).toEqual({ ok: false, error: "transition_not_allowed" });
  });

  it("refuses a value outside the status enum", async () => {
    stubSession({ selectResult: { data: { id: "listing-1", status: "draft", slug: "s" } } });
    const result = await setListingStatusAction("landlord", "listing-1", "sold");
    expect(result).toEqual({ ok: false, error: "transition_not_allowed" });
  });

  it("reports not_found for a listing the caller cannot see", async () => {
    stubSession({ selectResult: { data: null } });
    const result = await setListingStatusAction("landlord", "listing-1", "archived");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("submitListingForReviewAction", () => {
  it("requires an approved capability", async () => {
    loadMyMembershipSummary.mockResolvedValue([]);
    const result = await submitListingForReviewAction("landlord", "listing-1", "");
    expect(result).toEqual({ ok: false, error: "capability_required" });
  });
});
