import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  publicEnv: { supabaseUrl: "https://example.supabase.co" },
}));

import { projectMediaPublicUrl } from "./storage";

describe("projectMediaPublicUrl", () => {
  it("builds a public URL from a project object path", () => {
    expect(projectMediaPublicUrl("projects/abc/photo.jpg")).toBe(
      "https://example.supabase.co/storage/v1/object/public/project-media/projects/abc/photo.jpg",
    );
  });

  it("returns null for an external image reference", () => {
    expect(projectMediaPublicUrl("https://imgur.com/undefined")).toBeNull();
  });

  it("returns null for an empty path", () => {
    expect(projectMediaPublicUrl("")).toBeNull();
  });
});
