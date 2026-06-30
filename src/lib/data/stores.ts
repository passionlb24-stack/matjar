import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  featuredStores,
  stores as demoStores,
  SHOW_DEMO_STORES,
  type CategoryKey,
  type RegionKey,
  type Store,
} from "@/lib/catalog";

// Maps a database store row into the shape the StoreCard expects.
function rowToStore(row: {
  id: string;
  name: string;
  area: string | null;
  region: string | null;
  plan: "free" | "pro" | null;
  business_types: { slug: string } | null;
}): Store {
  return {
    id: row.id,
    name: { ar: row.name, en: row.name },
    area: { ar: row.area ?? "", en: row.area ?? "" },
    region: (row.region as RegionKey) ?? undefined,
    category: (row.business_types?.slug as CategoryKey) ?? "retail",
    isOpen: true,
    plan: row.plan ?? "free",
  };
}

async function fetchActiveStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id, name, area, region, plan, business_types(slug)")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const list = ((data ?? []) as unknown as Parameters<typeof rowToStore>[0][]).map(
    rowToStore,
  );

  // Attach real average ratings from reviews.
  if (list.length) {
    const ids = list.map((s) => s.id);
    const { data: revs } = await supabase
      .from("reviews")
      .select("store_id, rating")
      .in("store_id", ids);
    const agg = new Map<string, { sum: number; count: number }>();
    ((revs ?? []) as { store_id: string; rating: number }[]).forEach((r) => {
      const a = agg.get(r.store_id) ?? { sum: 0, count: 0 };
      a.sum += r.rating;
      a.count += 1;
      agg.set(r.store_id, a);
    });
    list.forEach((s) => {
      const a = agg.get(s.id);
      if (a) {
        s.rating = a.sum / a.count;
        s.reviews = a.count;
      }
    });
  }

  return list;
}

// Real active stores, optionally padded with demo samples so listings aren't
// empty before the platform fills up.
export async function getStoresForListing(): Promise<Store[]> {
  const real = await fetchActiveStores();
  if (!SHOW_DEMO_STORES) return real;
  const realIds = new Set(real.map((s) => s.id));
  return [...real, ...demoStores.filter((s) => !realIds.has(s.id))];
}

export async function getFeaturedStores(limit = 4): Promise<Store[]> {
  const real = await fetchActiveStores();
  if (!SHOW_DEMO_STORES) return real.slice(0, limit);
  const realIds = new Set(real.map((s) => s.id));
  return [...real, ...featuredStores.filter((s) => !realIds.has(s.id))].slice(
    0,
    limit,
  );
}
