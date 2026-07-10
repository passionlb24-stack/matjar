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
  is_verified: boolean | null;
  featured_until: string | null;
  logo_url: string | null;
  cover_url: string | null;
  lat: number | null;
  lng: number | null;
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
    verified: row.is_verified ?? false,
    featured:
      row.featured_until != null && new Date(row.featured_until) > new Date(),
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
  };
}

// Bounded so the explore/category pages never issue an unbounded query. The
// client still filters + sorts (incl. "near me", which needs coordinates in
// memory) within this window; beyond it, users rely on search. Raise or move
// to server-side pagination / PostGIS nearest-search when store count nears it.
const STORE_FETCH_LIMIT = 200;

async function fetchActiveStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id, name, area, region, plan, is_verified, featured_until, logo_url, cover_url, lat, lng, business_types(slug)")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(STORE_FETCH_LIMIT);
  const list = ((data ?? []) as unknown as Parameters<typeof rowToStore>[0][]).map(
    rowToStore,
  );
  // Paid featured stores float to the top of the default listing (stable
  // otherwise — the pages re-sort for "near me"/rating when the user asks).
  list.sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false));

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

// Marks which stores the current user has saved (followed).
async function markFavorites(list: Store[]): Promise<Store[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return list;
  const { data: favs } = await supabase
    .from("follows")
    .select("store_id")
    .eq("user_id", user.id);
  const ids = new Set(
    ((favs ?? []) as { store_id: string }[]).map((f) => f.store_id),
  );
  list.forEach((s) => {
    s.favorited = ids.has(s.id);
  });
  return list;
}

// Real active stores, optionally padded with demo samples so listings aren't
// empty before the platform fills up.
export async function getStoresForListing(): Promise<Store[]> {
  const real = await fetchActiveStores();
  if (!SHOW_DEMO_STORES) return markFavorites(real);
  const realIds = new Set(real.map((s) => s.id));
  return markFavorites([
    ...real,
    ...demoStores.filter((s) => !realIds.has(s.id)),
  ]);
}

// Name search for the unified search page (trigram-backed ilike).
export async function searchStores(
  q: string,
  region?: string,
): Promise<Store[]> {
  const term = q.trim();
  if (!term) return [];
  const supabase = await createClient();
  let query = supabase
    .from("stores")
    .select(
      "id, name, area, region, plan, is_verified, logo_url, cover_url, lat, lng, business_types(slug)",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .ilike("name", `%${term}%`);
  if (region && region !== "all") query = query.eq("region", region);
  const { data } = await query.limit(24);
  const list = ((data ?? []) as unknown as Parameters<typeof rowToStore>[0][]).map(
    rowToStore,
  );
  return markFavorites(list);
}

export async function getFeaturedStores(limit = 4): Promise<Store[]> {
  const real = await fetchActiveStores();
  if (!SHOW_DEMO_STORES) return markFavorites(real.slice(0, limit));
  const realIds = new Set(real.map((s) => s.id));
  return markFavorites(
    [...real, ...featuredStores.filter((s) => !realIds.has(s.id))].slice(
      0,
      limit,
    ),
  );
}
