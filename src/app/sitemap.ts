import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { categoryKeys } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { getAcademyGuides } from "@/lib/data/academy";
import { SITE_URL } from "@/lib/site";

const STATIC_PATHS = [
  "",
  "/explore",
  "/categories",
  "/market",
  "/offers",
  "/flash",
  "/delivery",
  "/jobs",
  "/freelance",
  "/wholesale",
  "/clearance",
  "/best-sellers",
  "/map",
  "/merchants",
  "/trust",
  "/hub",
  "/hub/academy",
  "/hub/leaders",
  "/pricing",
  "/about",
  "/help",
  "/contact",
  "/privacy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static + category pages, per locale.
  for (const lang of locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: `${SITE_URL}/${lang}${path}`,
        changeFrequency: "weekly",
        priority: path === "" ? 1 : 0.6,
      });
    }
    for (const key of categoryKeys) {
      entries.push({
        url: `${SITE_URL}/${lang}/category/${key}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  // Real, public content (RLS already limits each table to the public rows).
  try {
    const supabase = await createClient();
    const [
      { data: stores },
      { data: products },
      { data: listings },
      { data: jobs },
      { data: gigs },
      { data: wholesale },
      { data: sitePages },
      { data: leaders },
      guides,
    ] = await Promise.all([
      // slug when present → clean vanity URL (/[handle]); UUID route otherwise.
      supabase
        .from("stores")
        .select("id, slug, updated_at")
        .eq("status", "active")
        .is("deleted_at", null),
      supabase
        .from("products")
        .select("id, updated_at")
        .eq("status", "active")
        .eq("is_available", true)
        .is("deleted_at", null),
      supabase.from("listings").select("id, updated_at").eq("status", "active"),
      // jobs/gigs/wholesale/leaders have no updated_at column — id/slug only.
      supabase.from("job_postings").select("id").eq("status", "active"),
      supabase.from("gigs").select("id").eq("status", "active"),
      supabase
        .from("wholesale_products")
        .select("id")
        .eq("status", "active"),
      supabase
        .from("site_pages")
        .select("slug, updated_at")
        .eq("published", true),
      supabase.from("business_leaders").select("slug").eq("published", true),
      // DB-backed academy guides (falls back to the in-repo set when unseeded).
      getAcademyGuides(),
    ]);

    const asDate = (v: unknown) => (v ? new Date(v as string) : undefined);

    for (const lang of locales) {
      for (const s of stores ?? []) {
        const slug = s.slug as string | null;
        entries.push({
          url: slug
            ? `${SITE_URL}/${lang}/${slug}`
            : `${SITE_URL}/${lang}/store/${s.id}`,
          lastModified: asDate(s.updated_at),
          changeFrequency: "daily",
          priority: 0.8,
        });
      }
      for (const p of products ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/product/${p.id}`,
          lastModified: asDate(p.updated_at),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
      for (const li of listings ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/market/${li.id}`,
          lastModified: asDate(li.updated_at),
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
      for (const j of jobs ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/jobs/${j.id}`,
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
      for (const g of gigs ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/freelance/${g.id}`,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
      for (const w of wholesale ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/wholesale/${w.id}`,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
      for (const pg of sitePages ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/p/${pg.slug}`,
          lastModified: asDate(pg.updated_at),
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
      for (const g of guides) {
        entries.push({
          url: `${SITE_URL}/${lang}/hub/academy/${g.slug}`,
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
      for (const ld of leaders ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/hub/leaders/${ld.slug}`,
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    }
  } catch {
    // If the DB is unreachable at build time, still return the static sitemap.
  }

  return entries;
}
