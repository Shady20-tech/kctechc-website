/**
 * Test stub for the `server-only` marker package.
 *
 * Next.js resolves `server-only` to a build-time guard that throws when a
 * server module is imported into client code. Vitest has no such resolution, so
 * it is aliased here to a no-op. The real guard still applies to app builds.
 */
export {};
