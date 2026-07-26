import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Resource-hungry SEO/AI crawlers hammer the dynamic pages and burn
      // serverless CPU without sending us a single visitor. Search engines
      // that actually matter (Google/Bing) stay fully allowed below.
      {
        userAgent: [
          "AhrefsBot",
          "SemrushBot",
          "MJ12bot",
          "DotBot",
          "PetalBot",
          "Bytespider",
          "DataForSeoBot",
          "BLEXBot",
        ],
        disallow: "/",
      },
      {
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
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
