import "@testing-library/jest-dom/vitest";

/**
 * `window.matchMedia` is not implemented by jsdom, and a component that reads it
 * during render throws `window.matchMedia is not a function` rather than
 * degrading. The default stub reports "no match" for every query, which is the
 * state a fresh browser is in — a test that needs a specific media query to match
 * overrides it locally with `vi.stubGlobal`.
 */
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
