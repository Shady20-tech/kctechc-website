import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function actionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect(start, `${name} is missing`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

const SURFACES: { file: string; actions: string[] }[] = [
  {
    file: "src/lib/store/admin-actions.ts",
    actions: ["createProductAction", "updateProductAction"],
  },
  {
    file: "src/lib/store/media-actions.ts",
    actions: ["uploadProductImageAction"],
  },
  {
    file: "src/lib/content/admin-actions.ts",
    actions: [
      "createInsightAction",
      "updateInsightAction",
      "uploadInsightImageAction",
    ],
  },
  {
    file: "src/lib/content/project-admin-actions.ts",
    actions: [
      "createProjectAction",
      "updateProjectAction",
      "uploadProjectMediaAction",
    ],
  },
  {
    file: "src/lib/real-estate/admin-actions.ts",
    actions: [
      "createListingAction",
      "updateListingAction",
      "commitListingImportAction",
    ],
  },
  {
    file: "src/lib/real-estate/media-actions.ts",
    actions: ["uploadListingImageAction"],
  },
  {
    file: "src/lib/real-estate/dashboard-actions.ts",
    actions: [
      "createDashboardListingAction",
      "updateDashboardListingAction",
      "uploadDashboardListingImageAction",
    ],
  },
];

describe("translation sync coverage", () => {
  it.each(SURFACES)(
    "$file drains the queue after every translatable write",
    ({ file, actions }) => {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(source).toContain("scheduleTranslationSync");
      for (const action of actions) {
        expect(actionBody(source, action), `${file} ${action}`).toContain(
          "scheduleTranslationSync",
        );
      }
    },
  );
});
