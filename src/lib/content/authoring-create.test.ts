import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const CREATE_ACTIONS = [
  "src/lib/store/admin-actions.ts",
  "src/lib/real-estate/admin-actions.ts",
  "src/lib/real-estate/dashboard-actions.ts",
  "src/lib/content/admin-actions.ts",
  "src/lib/content/project-admin-actions.ts",
] as const;

describe("every authoring create path generates its own slug", () => {
  for (const path of CREATE_ACTIONS) {
    it(path, () => {
      const source = readFileSync(join(ROOT, path), "utf8");
      expect(source).toContain("slugifyTitle");
      expect(source).toContain("uniqueSlug");
    });
  }
});
