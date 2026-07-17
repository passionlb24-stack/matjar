import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/config";
import type { Store } from "@/lib/catalog";
import { searchStores } from "./stores";
import { getActiveListings, type ListingCard } from "./market";

export type ProductResult = {
  id: string;
  name: string;
  nameEn: string | null;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  storeName: string;
};

export type SearchResults = {
  stores: Store[];
  products: ProductResult[];
  listings: ListingCard[];
};

async function searchProducts(q: string): Promise<ProductResult[]> {
  const term = q.trim();
  if (!term) return [];
  const supabase = await createClient();
  // Fuzzy product search (name + name_en, trigram + ILIKE) so close/misspelled
  // terms and English names surface. The RPC already filters to active/available
  // products of active stores and ranks by best match. See migration 0114.
  const { data } = await supabase.rpc("search_products_fuzzy", { p_q: term });

  const rows = (data ?? []) as {
    id: string;
    name: string;
    name_en: string | null;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    store_name: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
    price: Number(r.price),
    discountPrice: r.discount_price != null ? Number(r.discount_price) : null,
    imageUrl: r.image_url,
    storeName: r.store_name ?? "",
  }));
}

// One query fan-out across the three public entities: stores, products, and
// Sunday Market listings. All name/title matches are trigram-indexed.
export async function searchAll(
  q: string,
  lang: Locale,
  region?: string,
): Promise<SearchResults> {
  const term = q.trim();
  if (!term) return { stores: [], products: [], listings: [] };
  const [stores, products, listings] = await Promise.all([
    searchStores(term, region),
    searchProducts(term),
    getActiveListings(
      lang,
      { q: term, region: region && region !== "all" ? region : undefined },
      24,
    ),
  ]);
  return { stores, products, listings };
}
