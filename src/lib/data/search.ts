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
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, name_en, price, discount_price, image_url, stores!inner(name, status)",
    )
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null)
    .ilike("name", `%${term}%`)
    .limit(24);

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    name_en: string | null;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    stores: { name: string; status: string } | null;
  }[];

  return rows
    .filter((r) => r.stores?.status === "active")
    .map((r) => ({
      id: r.id,
      name: r.name,
      nameEn: r.name_en,
      price: Number(r.price),
      discountPrice: r.discount_price != null ? Number(r.discount_price) : null,
      imageUrl: r.image_url,
      storeName: r.stores?.name ?? "",
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
