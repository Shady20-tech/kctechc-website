import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_ROLES } from "@/lib/auth/roles";
import { reviewDecisionSchema, reviewSubmissionSchema } from "./schema";
import {
  averageRating,
  decisionRequiresNote,
  MODERATOR_DECISIONS,
  ratingBreakdown,
  REVIEW_MODERATOR_ROLES,
  REVIEW_STATUSES,
} from "./types";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function migrationNamed(fragment: string): string {
  const file = readdirSync(MIGRATIONS).find(
    (name) => name.includes(fragment) && name.endsWith(".sql"),
  );
  if (!file) throw new Error(`no migration matching ${fragment}`);
  return readFileSync(join(MIGRATIONS, file), "utf8");
}

const reviewsMigration = migrationNamed("customer_reviews");

/** The members of a `create type public.<name> as enum (...)` block. */
function enumMembers(sql: string, typeName: string): string[] {
  const match = new RegExp(
    `create type public\\.${typeName} as enum \\(([\\s\\S]*?)\\)`,
    "i",
  ).exec(sql);
  if (!match?.[1]) throw new Error(`enum ${typeName} not found`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
}

/** The role literals inside `is_review_moderator()`. */
function moderatorRolesInSql(): string[] {
  const fn = /create or replace function public\.is_review_moderator\(\)([\s\S]*?)\$\$;/i.exec(
    reviewsMigration,
  );
  if (!fn?.[1]) throw new Error("is_review_moderator not found");
  return [...fn[1].matchAll(/'([a-z_]+)'/g)]
    .map((m) => m[1] as string)
    .filter((name) => name !== "public" && name !== "pg_temp");
}

describe("review status mirror", () => {
  it("matches the submission_status enum in the schema", () => {
    const enumSql = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(join(MIGRATIONS, name), "utf8"))
      .find((sql) => sql.includes("create type public.submission_status"));
    expect(enumSql).toBeTruthy();
    expect([...REVIEW_STATUSES].sort()).toEqual(
      enumMembers(enumSql as string, "submission_status").sort(),
    );
  });

  it("exposes only decided states as moderator decisions", () => {
    // `pending_review` is the entry state, never a decision.
    expect([...MODERATOR_DECISIONS].sort()).toEqual(
      ["approved", "rejected", "changes_requested"].sort(),
    );
    expect(MODERATOR_DECISIONS).not.toContain("pending_review");
  });
});

describe("review moderator roles", () => {
  it("agrees with is_review_moderator() in the migration", () => {
    // A drift here would mean the UI offers a decision the database refuses, or
    // the database allows one the console never shows.
    expect([...REVIEW_MODERATOR_ROLES].sort()).toEqual(moderatorRolesInSql().sort());
  });

  it("excludes agents and customers", () => {
    // An agent's own listings sit beside the reviews, which is a conflict of
    // interest; a landlord is a customer and a potential author.
    expect(REVIEW_MODERATOR_ROLES).not.toContain("real_estate_agent");
    expect(REVIEW_MODERATOR_ROLES).not.toContain("customer");
    expect(REVIEW_MODERATOR_ROLES).not.toContain("visitor");
  });

  it("names only roles that exist", () => {
    for (const role of REVIEW_MODERATOR_ROLES) {
      expect(APP_ROLES).toContain(role);
    }
  });
});

describe("review submission schema", () => {
  const VALID = {
    rating: "5",
    authorName: "A customer",
    title: "",
    body: "The team installed our solar system on time and explained everything.",
    departmentSlug: "",
    // The action converts the checkbox to a real boolean before validating.
    publishConsent: true,
  };

  it("accepts a well-formed submission", () => {
    const result = reviewSubmissionSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rating).toBe(5);
      expect(result.data.title).toBe("");
    }
  });

  it("rejects a rating outside 1..5", () => {
    for (const rating of ["0", "6", "2.5", "abc"]) {
      expect(
        reviewSubmissionSchema.safeParse({ ...VALID, rating }).success,
        rating,
      ).toBe(false);
    }
  });

  it("rejects a body shorter than a sentence", () => {
    expect(
      reviewSubmissionSchema.safeParse({ ...VALID, body: "good" }).success,
    ).toBe(false);
  });

  it("requires consent", () => {
    // An unchecked box is absent from the payload, so the absence must fail.
    expect(
      reviewSubmissionSchema.safeParse({ ...VALID, publishConsent: undefined })
        .success,
    ).toBe(false);
  });

  it("does not accept a status from the client", () => {
    const result = reviewSubmissionSchema.safeParse({
      ...VALID,
      status: "approved",
    });
    expect(result.success).toBe(true);
    expect(result.success && "status" in result.data).toBe(false);
  });
});

describe("review decision schema", () => {
  it("accepts each decision", () => {
    for (const decision of MODERATOR_DECISIONS) {
      expect(
        reviewDecisionSchema.safeParse({
          reviewId: "3f0f0f0f-0000-4000-8000-000000000000",
          decision,
          note: decision === "approved" ? "" : "Please clarify.",
        }).success,
        decision,
      ).toBe(true);
    }
  });

  it("rejects an unknown decision", () => {
    expect(
      reviewDecisionSchema.safeParse({
        reviewId: "3f0f0f0f-0000-4000-8000-000000000000",
        decision: "pending_review",
      }).success,
    ).toBe(false);
  });
});

describe("decision rules", () => {
  it("requires a note only for the two refusals", () => {
    expect(decisionRequiresNote("approved")).toBe(false);
    expect(decisionRequiresNote("rejected")).toBe(true);
    expect(decisionRequiresNote("changes_requested")).toBe(true);
  });
});

describe("rating aggregation", () => {
  it("returns null for no reviews rather than zero", () => {
    // "No reviews yet" and "rated zero" are different facts.
    expect(averageRating([])).toBeNull();
  });

  it("rounds to one decimal", () => {
    expect(averageRating([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toBe(4.3);
    expect(averageRating([{ rating: 5 }])).toBe(5);
  });

  it("counts each star level, including empty ones", () => {
    const breakdown = ratingBreakdown([
      { rating: 5 },
      { rating: 5 },
      { rating: 3 },
    ]);
    expect(breakdown).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 });
  });

  it("ignores an out-of-range rating rather than miscounting", () => {
    const breakdown = ratingBreakdown([{ rating: 9 }, { rating: 4 }]);
    expect(breakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 });
  });
});

describe("reviews migration", () => {
  it("enables RLS and only exposes approved rows publicly", () => {
    expect(reviewsMigration).toContain("alter table public.reviews enable row level security");
    expect(reviewsMigration).toMatch(
      /create policy "reviews_select_approved"[\s\S]*?using \(status = 'approved'\)/,
    );
  });

  it("refuses a submission that arrives pre-approved", () => {
    expect(reviewsMigration).toMatch(
      /create policy "reviews_insert_own"[\s\S]*?status = 'pending_review'/,
    );
  });

  it("forbids a moderator approving their own review", () => {
    expect(reviewsMigration).toMatch(
      /create policy "reviews_update_moderator"[\s\S]*?author_id <> auth\.uid\(\)/,
    );
  });

  it("requires consent before publication", () => {
    expect(reviewsMigration).toContain("reviews_publish_requires_consent");
    expect(reviewsMigration).toMatch(/status <> 'approved' or publish_consent/);
  });

  it("requires a reason for a refusal", () => {
    expect(reviewsMigration).toContain("reviews_refusal_requires_note");
  });

  it("constrains the rating to the 1..5 scale", () => {
    expect(reviewsMigration).toMatch(/rating between 1 and 5/);
  });

  it("revokes the new functions from browser roles where appropriate", () => {
    expect(reviewsMigration).toContain(
      "revoke all on function public.touch_reviews_updated_at() from anon, authenticated",
    );
    // The predicate is an RLS helper, so `authenticated` must keep it.
    expect(reviewsMigration).toContain(
      "grant execute on function public.is_review_moderator() to authenticated",
    );
    expect(reviewsMigration).toContain(
      "revoke all on function public.is_review_moderator() from anon",
    );
  });
});
