import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://opencabinet.pages.dev/sitemap.xml",
    host: "https://opencabinet.pages.dev",
  };
}
