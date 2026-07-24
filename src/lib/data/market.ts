import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public-client";
import type { Locale } from "@/i18n/config";

export type MarketCategory = {
  id: string;
  slug: string;
  name: string;
};

export type ListingCard = {
  id: string;
  title: string;
  price: number | null;
  image: string | null;
  city: string | null;
  region: string | null;
  categoryName: string;
  storeId: string | null;
  storeName: string | null;
  isFeatured: boolean;
  status: string;
  createdAt: string;
};

export type ListingDetail = ListingCard & {
  description: string | null;
  images: string[];
  views: number;
  savesCount: number;
  sellerId: string;
  isFavorited: boolean;
  // Merchant-listing contact so the buyer can act without hunting on the store.
  storeWhatsapp: string | null;
  storePhone: string | null;
  storeSlug: string | null;
};

type Row = {
  id: string;
  title: string;
  price: number | null;
  images: unknown;
  city: string | null;
  region: string | null;
  is_featured: boolean;
  status: string;
  created_at: string;
  store_id: string | null;
  seller_id: string;
  description?: string | null;
  views?: number;
  stores: {
    name: string;
    whatsapp?: string | null;
    phone?: string | null;
    slug?: string | null;
  } | null;
  market_categories: { name_ar: string; name_en: string } | null;
};

const catName = (
  c: { name_ar: string; name_en: string } | null,
  lang: Locale,
) => (c ? (lang === "ar" ? c.name_ar : c.name_en) : "");

const imagesOf = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

function toCard(r: Row, lang: Locale): ListingCard {
  const imgs = imagesOf(r.images);
  return {
    id: r.id,
    title: r.title,
    price: r.price != null ? Number(r.price) : null,
    image: imgs[0] ?? null,
    city: r.city,
    region: r.region,
    categoryName: catName(r.market_categories, lang),
    storeId: r.store_id,
    storeName: r.stores?.name ?? null,
    isFeatured: r.is_featured,
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function getMarketCategories(
  lang: Locale,
): Promise<MarketCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("market_categories")
    .select("id, slug, name_ar, name_en")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (
    (data ?? []) as { id: string; slug: string; name_ar: string; name_en: string }[]
  ).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: lang === "ar" ? c.name_ar : c.name_en,
  }));
}

export type MarketRegion = { key: string; name: string };

// Admin-managed region list (active only). Falls back to nothing if the table
// is empty — callers can default to the catalog regions.
export async function getMarketRegions(lang: Locale): Promise<MarketRegion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("market_regions")
    .select("key, name_ar, name_en")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (
    (data ?? []) as { key: string; name_ar: string; name_en: string }[]
  ).map((r) => ({ key: r.key, name: lang === "ar" ? r.name_ar : r.name_en }));
}

export type MarketCity = { id: string; region: string; name: string };

// Admin-managed city list (active only), ordered by region then sort_order.
export async function getMarketCities(lang: Locale): Promise<MarketCity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("market_cities")
    .select("id, region, name_ar, name_en")
    .eq("is_active", true)
    .order("region", { ascending: true })
    .order("sort_order", { ascending: true });
  return (
    (data ?? []) as {
      id: string;
      region: string;
      name_ar: string;
      name_en: string;
    }[]
  ).map((c) => ({
    id: c.id,
    region: c.region,
    name: lang === "ar" ? c.name_ar : c.name_en,
  }));
}

export type ListingFilters = {
  q?: string;
  category?: string; // slug
  region?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  datePosted?: "24h" | "7d" | "30d";
  sort?: "newest" | "oldest" | "cheapest" | "expensive";
};

const DATE_WINDOWS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

const SELECT =
  "id, title, price, images, city, region, is_featured, status, created_at, store_id, seller_id, stores(name), market_categories(name_ar, name_en)";

export async function getActiveListings(
  lang: Locale,
  filters: ListingFilters = {},
  limit = 60,
  offset = 0,
): Promise<ListingCard[]> {
  const supabase = await createClient();
  let query = supabase.from("listings").select(SELECT).eq("status", "active");

  if (filters.category) {
    const { data: cat } = await supabase
      .from("market_categories")
      .select("id")
      .eq("slug", filters.category)
      .maybeSingle();
    const catId = (cat as { id?: string } | null)?.id;
    if (catId) query = query.eq("category_id", catId);
    else return [];
  }
  if (filters.q?.trim()) query = query.ilike("title", `%${filters.q.trim()}%`);
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.city?.trim()) query = query.ilike("city", `%${filters.city.trim()}%`);
  if (filters.priceMin != null) query = query.gte("price", filters.priceMin);
  if (filters.priceMax != null) query = query.lte("price", filters.priceMax);
  if (filters.datePosted && DATE_WINDOWS[filters.datePosted]) {
    const cutoff = new Date(
      Date.now() - DATE_WINDOWS[filters.datePosted] * 24 * 60 * 60 * 1000,
    ).toISOString();
    query = query.gte("created_at", cutoff);
  }

  // Featured listings float to the top of the first page.
  query = query.order("is_featured", { ascending: false });
  switch (filters.sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "cheapest":
      query = query.order("price", { ascending: true, nullsFirst: false });
      break;
    case "expensive":
      query = query.order("price", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data } = await query.range(offset, offset + limit - 1);
  return ((data ?? []) as unknown as Row[]).map((r) => toCard(r, lang));
}

// The public listing row (the heavy join) minus the two request-scoped counts.
// savesCount / isFavorited are computed per-request below because
// listing_favorites is RLS-scoped to the caller's own rows — they can't be
// shared across visitors, so only the row itself is cached.
type PublicListing = Omit<ListingDetail, "isFavorited" | "savesCount">;

// Client-agnostic fetch + map for the listing row. `supabase` is the anon
// public client on the cached path, or the request-scoped client on the seller
// draft-preview fallback. RLS decides visibility; the query is identical.
async function fetchListingRow(
  supabase: SupabaseClient,
  id: string,
  lang: Locale,
): Promise<PublicListing | null> {
  const { data } = await supabase
    .from("listings")
    .select(
      "id, title, price, images, city, region, is_featured, status, created_at, store_id, seller_id, stores(name, whatsapp, phone, slug), market_categories(name_ar, name_en), description, views",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Row;
  return {
    ...toCard(r, lang),
    description: r.description ?? null,
    images: imagesOf(r.images),
    views: r.views ?? 0,
    sellerId: r.seller_id,
    storeWhatsapp: r.stores?.whatsapp ?? null,
    storePhone: r.stores?.phone ?? null,
    storeSlug: r.stores?.slug ?? null,
  };
}

// Cached public listing row: anon client → RLS returns active/sold/expired
// listings (the publicly visible set). Tagged listing:<id> for targeted bust.
function getPublicListingRow(
  id: string,
  lang: Locale,
): Promise<PublicListing | null> {
  return unstable_cache(
    () => fetchListingRow(createPublicClient(), id, lang),
    ["listing-view", id, lang],
    { revalidate: 120, tags: ["listings", `listing:${id}`] },
  )();
}

export async function getListingById(
  id: string,
  lang: Locale,
  currentUserId: string | null,
): Promise<ListingDetail | null> {
  // Common case: cached, cookie-less row.
  let row = await getPublicListingRow(id, lang);
  if (!row) {
    // Seller previewing a not-yet-public listing → request-scoped client sees
    // it via RLS. Uncached (per-user visibility).
    row = await fetchListingRow(await createClient(), id, lang);
    if (!row) return null;
  }

  // Per-request/per-user counts on the request-scoped client — identical to the
  // original behavior (listing_favorites is RLS-scoped to the caller).
  const supabase = await createClient();
  const [{ count }, favRes] = await Promise.all([
    supabase
      .from("listing_favorites")
      .select("listing_id", { count: "exact", head: true })
      .eq("listing_id", id),
    currentUserId
      ? supabase
          .from("listing_favorites")
          .select("listing_id")
          .eq("listing_id", id)
          .eq("user_id", currentUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...row,
    savesCount: count ?? 0,
    isFavorited: Boolean((favRes as { data: unknown }).data),
  };
}

export async function getMyListings(
  userId: string,
  lang: Locale,
): Promise<ListingCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(SELECT)
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as Row[]).map((r) => toCard(r, lang));
}
