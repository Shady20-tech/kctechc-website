import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./src/lib/config/redirects";
import { SERVER_ACTION_BODY_SIZE_LIMIT } from "./src/lib/uploads/limits";
import { buildContentSecurityPolicy } from "./src/lib/security/headers";

/**
 * Supabase Storage public URLs are the only remote image source in this phase.
 * `remotePatterns` is the current Next.js API; the deprecated `images.domains`
 * option is intentionally not used.
 *
 * The protocol is derived from the configured URL rather than pinned to `https`.
 * A hosted Supabase project is always `https`, so production is unchanged; the
 * Supabase CLI stack used for local development serves `http://127.0.0.1:54321`,
 * and a pinned `https` pattern silently rejects every product image there — the
 * optimizer answers 400 and the page logs a console error. Deriving the protocol
 * keeps both environments working from the same config.
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      hostname: parsed.hostname,
      protocol: parsed.protocol.replace(":", ""),
      // A hosted project has no port (and Next requires `port` to be omitted
      // then); the local CLI stack listens on `:54321`, and a pattern without a
      // port does not match a URL that has one.
      port: parsed.port,
    };
  } catch {
    return null;
  }
})();

/**
 * `next/image` refuses to optimize an image served from a private address unless
 * `dangerouslyAllowLocalIP` is set. A hosted Supabase project is a public host,
 * so production is unaffected; the local CLI stack is `127.0.0.1`, where every
 * product image would otherwise answer 400 from the optimizer. The flag is only
 * turned on when the configured Supabase host is itself loopback, so it cannot
 * silently widen the production surface.
 */
const supabaseIsLoopback =
  supabaseOrigin !== null &&
  ["127.0.0.1", "localhost", "::1", "[::1]"].includes(supabaseOrigin.hostname);

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = buildContentSecurityPolicy({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null,
  tolgeeApiUrl:
    process.env.NEXT_PUBLIC_TOLGEE_API_URL?.trim() ||
    "https://app.tolgee.io",
  isDevelopment,
  analyticsEnabled: Boolean(
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim(),
  ),
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-hosted VPS target: emit a standalone server bundle alongside the
  // regular build so the same codebase deploys to Vercel and to Node.
  output: "standalone",
  experimental: {
    serverActions: {
      // Every media form (product, article, property) posts a device file to a
      // Server Action as multipart form data, and Next refuses a body over this
      // limit before the action runs. The 1 MB default silently rejected any real
      // photograph, so the upload appeared to do nothing. The value tracks the
      // largest accepted image plus multipart overhead — see `src/lib/uploads/limits.ts`.
      bodySizeLimit: SERVER_ACTION_BODY_SIZE_LIMIT,
    },
  },
  images: {
    // Only enabled for a loopback Supabase host (local development); a hosted
    // project keeps the default `false`.
    dangerouslyAllowLocalIP: supabaseIsLoopback,
    remotePatterns: [
      ...(supabaseOrigin
        ? [
            {
              protocol: supabaseOrigin.protocol as "http" | "https",
              hostname: supabaseOrigin.hostname,
              ...(supabaseOrigin.port ? { port: supabaseOrigin.port } : {}),
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
  async redirects() {
    // Legacy paths map to their canonical equivalent with a permanent redirect,
    // so an existing inbound link or bookmark keeps working and the canonical URL
    // is the only one search engines index.
    return LEGACY_REDIRECTS.map(({ from, to }) => ({
      source: from,
      destination: to,
      permanent: true,
    }));
  },
};

export default nextConfig;
