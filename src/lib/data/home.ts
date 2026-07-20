import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-client";
import { getStoresForListing } from "@/lib/data/stores";
import type { Store } from "@/lib/catalog";

// Food-category stores for the homepage "Restaurants near you" rail. Reuses the
// cached active-stores listing (padded with demo samples early on) and filters
// to food so the rail is never empty on a fresh platform.
export async function getRestaurants(limit = 8): Promise<Store[]> {
  const all = await getStoresForListing();
  return all.filter((s) => s.category === "food").slice(0, limit);
}

export type LatestJob = {
  id: string;
  title: string;
  company_name: string;
  region: string | null;
  job_type: string | null;
  salary_note: string | null;
};

// Newest active job postings for the homepage teaser. Public read, cached.
export const getLatestJobs = unstable_cache(
  async (limit = 4): Promise<LatestJob[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("job_postings")
      .select("id, title, company_name, region, job_type, salary_note")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as LatestJob[];
  },
  ["home-latest-jobs"],
  { revalidate: 300 },
);

// Real, honest platform counts for the homepage stat rows — cached so the
// numbers don't add a per-request DB round-trip. Deliberately conservative:
// we count only live/active rows and never fabricate figures.
export const getHomeCounts = unstable_cache(
  async (): Promise<{ stores: number; products: number }> => {
    const supabase = createPublicClient();
    const [stores, products, listings] = await Promise.all([
      supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);
    return {
      stores: stores.count ?? 0,
      products: (products.count ?? 0) + (listings.count ?? 0),
    };
  },
  ["home-counts"],
  { revalidate: 600 },
);
