// Canonical public base URL, used for SEO (sitemap, robots, Open Graph). Override
// with NEXT_PUBLIC_SITE_URL once the custom domain (matjarlb.com) is connected.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://matjar-rouge.vercel.app";

// Per-page canonical + hreflang alternates for a bilingual page. `path` is the
// locale-less path (e.g. "/store/123", or "" for the home page). Values are
// relative — Next resolves them against metadataBase.
export function localeAlternates(lang: string, path: string) {
  const p = path === "/" ? "" : path;
  return {
    canonical: `/${lang}${p}`,
    languages: {
      ar: `/ar${p}`,
      en: `/en${p}`,
      "x-default": `/ar${p}`,
    },
  };
}
