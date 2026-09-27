import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Admin layout integrity.
 *
 * The console shell — sidebar, top bar, account menu — must be rendered by the
 * `(console)` layout and by nothing else, so every console route inherits exactly
 * one sidebar rather than each page growing its own. The sign-in and access-denied
 * pages sit outside that group and must still carry the `main` landmark and the
 * page container, which the old outer layout used to provide.
 *
 * This is asserted against the source because the failure mode is structural:
 * a page that forgets its wrapper still compiles, still type-checks, and only
 * shows up as an unstyled or landmark-less page. A test that reads the files is
 * the cheapest way to make that mistake impossible to reintroduce.
 */

const ADMIN_DIR = join(process.cwd(), "src/app/(static)/admin");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === "page.tsx" || entry === "layout.tsx") out.push(full);
  }
  return out;
}

const files = walk(ADMIN_DIR);
const pages = files.filter((f) => f.endsWith("page.tsx"));
const layouts = files.filter((f) => f.endsWith("layout.tsx"));

describe("admin console shell", () => {
  it("renders the sidebar from the console layout only", () => {
    for (const file of pages) {
      const source = readFileSync(file, "utf8");
      expect(
        source.includes("AdminSidebar"),
        `${file} renders its own sidebar; the console layout owns it`,
      ).toBe(false);
    }
  });

  it("does not wrap a page in its own console layout", () => {
    for (const page of pages) {
      const source = readFileSync(page, "utf8");
      expect(source.includes("AdminUserMenu")).toBe(false);
    }
  });

  it("has a console layout that renders the sidebar and account menu once", () => {
    const consoleLayout = join(ADMIN_DIR, "(console)/layout.tsx");
    const source = readFileSync(consoleLayout, "utf8");
    expect(source.includes("<AdminSidebar")).toBe(true);
    expect(source.includes("<AdminUserMenu")).toBe(true);
  });
});

describe("admin landmark and container", () => {
  it("gives every admin page exactly one main landmark", () => {
    for (const page of pages) {
      const own = (readFileSync(page, "utf8").match(/id="main"/g) ?? []).length;
      const inConsole = page.includes("(console)");
      // Console pages take their landmark from the console layout; the pages
      // outside it must supply their own.
      const expected = inConsole ? 0 : 1;
      expect(own, `${page} has ${own} main landmarks`).toBe(expected);
    }
  });

  it("gives every console layout exactly one main landmark", () => {
    const source = readFileSync(join(ADMIN_DIR, "(console)/layout.tsx"), "utf8");
    expect((source.match(/id="main"/g) ?? []).length).toBe(1);
  });

  it("keeps the outer admin layout chrome-free", () => {
    const source = readFileSync(join(ADMIN_DIR, "layout.tsx"), "utf8");
    expect(source.includes("AdminSidebar")).toBe(false);
    expect(source.includes('id="main"')).toBe(false);
  });

  it("keeps the sign-in and access-denied pages inside the container", () => {
    for (const name of ["login", "unauthorized"]) {
      const source = readFileSync(join(ADMIN_DIR, `${name}/page.tsx`), "utf8");
      expect(source.includes('id="main"'), `${name} lost its landmark`).toBe(true);
      expect(source.includes("container-page"), `${name} lost its container`).toBe(true);
    }
  });
});

describe("admin layouts", () => {
  it("only the console group declares a nested layout", () => {
    const relative = layouts.map((l) => l.replace(ADMIN_DIR, ""));
    expect([...relative].sort()).toEqual(
      ["/(console)/layout.tsx", "/layout.tsx"].sort(),
    );
  });

  it("applies noindex to every admin route from the outer layout", () => {
    const source = readFileSync(join(ADMIN_DIR, "layout.tsx"), "utf8");
    expect(source.includes("index: false")).toBe(true);
    expect(source.includes("nocache: true")).toBe(true);
  });
});
