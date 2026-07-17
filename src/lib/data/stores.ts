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
import { isOpenNow, parseHours } from "@/lib/hours";

// Maps a database store row into the shape the StoreCard expects.
function rowToStore(row: {
  id: string;
  name: string;
  area: string | null;
  region: string | null;
  plan: "free" | "pro" | null;
  is_verified: boolean | null;
  commercial_reg_verified: boolean | null;
  featured_until: string | null;
  logo_url: string | null;
  cover_url: string | null;
  lat: number | null;
  lng: number | null;
  hours?: unknown;
  business_types: { slug: string } | null;
  rating_avg: number | null;
  rating_count: number | null;
}): Store {
  // Real open/closed from structured hours; stores without configured hours
  // default to open (never scare customers away over missing data).
  const open = isOpenNow(parseHours(row.hours), new Date());
  // Denormalized rating columns, kept current by the reviews trigger (migration
  // 0091). rating stays undefined at 0 reviews so the card hides the rating
  // block; reviews carries the raw count.
  const ratingAvg = row.rating_avg != null ? Number(row.rating_avg) : 0;
  return {
    id: row.id,
    name: { ar: row.name, en: row.name },
    area: { ar: row.area ?? "", en: row.area ?? "" },
    region: (row.region as RegionKey) ?? undefined,
    category: (row.business_types?.slug as CategoryKey) ?? "retail",
    isOpen: open ?? true,
    plan: row.plan ?? "free",
    verified: row.is_verified ?? false,
    registered: row.commercial_reg_verified ?? false,
    rating: ratingAvg > 0 ? ratingAvg : undefined,
    reviews: row.rating_count != null ? Number(row.rating_count) : 0,
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
    .select("id, name, area, region, plan, is_verified, commercial_reg_verified, featured_until, logo_url, cover_url, lat, lng, hours, rating_avg, rating_count, business_types(slug)")
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

  await attachLocations(list);
  return list;
}

// Attaches the active branch locations of each store (one query, scoped to
// just these ids). "Near me" ranks a store by its closest branch and the map
// draws a pin per branch, so the listing needs every branch's coordinates —
// not only the primary lat/lng copied onto the store row.
async function attachLocations(list: Store[]): Promise<void> {
  if (!list.length) return;
  const supabase = await createClient();
  const ids = list.map((s) => s.id);
  const { data: locs } = await supabase
    .from("store_locations")
    .select("id, store_id, name, area, lat, lng")
    .in("store_id", ids)
    .eq("is_active", true);
  const byStore = new Map<string, NonNullable<Store["locations"]>>();
  (
    (locs ?? []) as {
      id: string;
      store_id: string;
      name: string | null;
      area: string | null;
      lat: number | null;
      lng: number | null;
    }[]
  ).forEach((l) => {
    const arr = byStore.get(l.store_id) ?? [];
    arr.push({
      id: l.id,
      name: l.name,
      area: l.area,
      lat: l.lat != null ? Number(l.lat) : null,
      lng: l.lng != null ? Number(l.lng) : null,
    });
    byStore.set(l.store_id, arr);
  });
  list.forEach((s) => {
    const arr = byStore.get(s.id);
    if (arr) s.locations = arr;
  });
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
      "id, name, area, region, plan, is_verified, logo_url, cover_url, lat, lng, hours, rating_avg, rating_count, business_types(slug)",
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

// Homepage "featured" strip = PAYING stores only: Pro plan, or a store an admin
// flagged featured (featured_until in the future). Free stores never appear here
// — the strip is a paid placement. Dedicated limit-bound query (was reusing the
// 200-store listing + all-reviews path just to slice 4).
export async function getFeaturedStores(limit = 4): Promise<Store[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("stores")
    .select(
      "id, name, area, region, plan, is_verified, commercial_reg_verified, featured_until, logo_url, cover_url, lat, lng, hours, rating_avg, rating_count, business_types(slug)",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .or(`plan.eq.pro,featured_until.gt.${nowIso}`)
    .limit(limit);
  const real = (
    (data ?? []) as unknown as Parameters<typeof rowToStore>[0][]
  ).map(rowToStore);
  // Featured (paid placement) floats above plain Pro.
  real.sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false));
  if (!SHOW_DEMO_STORES) return markFavorites(real.slice(0, limit));
  const realIds = new Set(real.map((s) => s.id));
  return markFavorites(
    [...real, ...featuredStores.filter((s) => !realIds.has(s.id))].slice(
      0,
      limit,
    ),
  );
}
