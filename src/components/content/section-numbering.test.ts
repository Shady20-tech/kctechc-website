import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Numbered eyebrow sequence.
 *
 * Every section on a page carries an ordinal ("01 —", "02 —", ...). The numbers
 * are interpolated at render time, so inserting or removing a section silently
 * renumbers the rest, and nothing type-checks: a duplicate or a gap is only
 * visible in the rendered HTML. That happened here — adding the completed-work
 * gallery to Electrical Services pushed the shared sections from 03 to 05,
 * skipping 04, and every unit test still passed.
 *
 * This asserts the *shape* of the source rather than the rendered page, because
 * the build is not part of the test run: the department page derives its shared
 * numbers from `sharedSectionOffset`, and that offset must equal the number of
 * Electrical-Services-only sections minus the one section the base numbering
 * already accounts for.
 */
const DEPT_PAGE = join(
  process.cwd(),
  "src/app/(site)/[locale]/[department]/page.tsx",
);

describe("department page section numbering", () => {
  const source = readFileSync(DEPT_PAGE, "utf8");

  it("numbers the Electrical-Services-only sections 01, 02 and 03", () => {
    // The three extras are rendered with literal eyebrows, not `sectionNumber`.
    expect(source).toContain("`01 — ${t(\"electricalProducts.eyebrow\")}`");
    expect(source).toContain("`02 — ${t(\"electricalProducts.brands.eyebrow\")}`");
    expect(source).toContain("`03 — ${t(\"electricalProducts.work.eyebrow\")}`");
  });

  it("offsets the shared sections by two, so the sequence stays contiguous", () => {
    // Three extras, but the shared numbers start at 02 for the first shared
    // section, so the shift is 3 - 1 = 2. An offset of 3 renders 05 where 04
    // belongs; an offset of 1 repeats 03.
    const match = source.match(
      /sharedSectionOffset = definition\.slug === "electrical-services"\s*\?\s*(\d+)/,
    );
    expect(match, "sharedSectionOffset expression not found").not.toBeNull();
    expect(Number(match?.[1])).toBe(2);
  });

  it("starts the shared sections at two, which the offset is derived against", () => {
    expect(source).toContain("sectionNumber(2)");
  });
});
