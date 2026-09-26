import type { NextConfig } from "next";
import { buildContentSecurityPolicy } from "./src/lib/security/headers";

/**
 * Supabase Storage public URLs are the only remote image source in this phase.
 * `remotePatterns` is the current Next.js API; the deprecated `images.domains`
 * option is intentionally not used.
 */
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = buildContentSecurityPolicy({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null,
  tolgeeApiUrl:
    process.env.NEXT_PUBLIC_TOLGEE_API_URL?.trim() ||
    "https://app.tolgee.io",
  isDevelopment,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-hosted VPS target: emit a standalone server bundle alongside the
  // regular build so the same codebase deploys to Vercel and to Node.
  output: "standalone",
  images: {
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
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
};

export default nextConfig;
