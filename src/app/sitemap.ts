import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { categoryKeys } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

const STATIC_PATHS = [
  "",
  "/explore",
  "/categories",
  "/market",
  "/offers",
  "/flash",
  "/clearance",
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

  // Real, public stores + products (RLS already limits to active ones).
  try {
    const supabase = await createClient();
    const [{ data: stores }, { data: products }, { data: listings }] =
      await Promise.all([
        supabase
          .from("stores")
          .select("id, updated_at")
          .eq("status", "active")
          .is("deleted_at", null),
        supabase
          .from("products")
          .select("id, updated_at")
          .eq("status", "active")
          .eq("is_available", true)
          .is("deleted_at", null),
        supabase
          .from("listings")
          .select("id, updated_at")
          .eq("status", "active"),
      ]);
    for (const lang of locales) {
      for (const s of stores ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/store/${s.id}`,
          lastModified: s.updated_at ? new Date(s.updated_at as string) : undefined,
          changeFrequency: "daily",
          priority: 0.8,
        });
      }
      for (const p of products ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/product/${p.id}`,
          lastModified: p.updated_at ? new Date(p.updated_at as string) : undefined,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
      for (const li of listings ?? []) {
        entries.push({
          url: `${SITE_URL}/${lang}/market/${li.id}`,
          lastModified: li.updated_at
            ? new Date(li.updated_at as string)
            : undefined,
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
    }
  } catch {
    // If the DB is unreachable at build time, still return the static sitemap.
  }

  return entries;
}
