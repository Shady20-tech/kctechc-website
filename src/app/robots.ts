import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/config/env";

/**
 * robots.txt
 *
 * Admin, auth and API surfaces are disallowed as a courtesy; the `noindex`
 * metadata on those routes is the authoritative control.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/auth/", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
