import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private surfaces out of search results.
      disallow: ["/ar/merchant", "/en/merchant", "/ar/admin", "/en/admin", "/ar/account", "/en/account"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
