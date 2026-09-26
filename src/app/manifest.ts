import type { MetadataRoute } from "next";

/**
 * Global manifest. Kept minimal and factual; icons and screenshots are added
 * when brand assets are supplied.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KC Technology Corporation",
    short_name: "KC Technology",
    description:
      "Digital marketing, electrical services and real estate across Cameroon.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#06090B",
  };
}
