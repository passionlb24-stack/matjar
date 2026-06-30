// Canonical public base URL, used for SEO (sitemap, robots, Open Graph). Override
// with NEXT_PUBLIC_SITE_URL once the custom domain (matjarlb.com) is connected.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://matjar-rouge.vercel.app";
