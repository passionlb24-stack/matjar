import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private + non-indexable surfaces out of search results.
      disallow: [
        "/ar/merchant", "/en/merchant",
        "/ar/admin", "/en/admin",
        "/ar/account", "/en/account",
        "/ar/orders", "/en/orders",
        "/ar/bookings", "/en/bookings",
        "/ar/messages", "/en/messages",
        "/ar/notifications", "/en/notifications",
        "/ar/wishlist", "/en/wishlist",
        "/ar/favorites", "/en/favorites",
        "/ar/following", "/en/following",
        "/ar/track", "/en/track",
        "/ar/search", "/en/search",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
