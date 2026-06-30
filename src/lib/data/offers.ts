import { createClient } from "@/lib/supabase/server";

export type OfferProduct = {
  id: string;
  name: string;
  price: number;
  discountPrice: number;
  imageUrl: string | null;
  storeId: string;
  storeName: string;
  off: number; // discount percentage
};

// Active, discounted products of active stores — the "Today's offers" feed.
// RLS already limits to publicly visible products, so no extra gating needed.
export async function getOffers(limit = 60): Promise<OfferProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, price, discount_price, image_url, store_id, stores(name)")
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null)
    .not("discount_price", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    price: number;
    discount_price: number;
    image_url: string | null;
    store_id: string;
    stores: { name: string } | null;
  }[];

  return rows
    .map((r) => {
      const price = Number(r.price);
      const discountPrice = Number(r.discount_price);
      return {
        id: r.id,
        name: r.name,
        price,
        discountPrice,
        imageUrl: r.image_url,
        storeId: r.store_id,
        storeName: r.stores?.name ?? "",
        off: price > 0 ? Math.round((1 - discountPrice / price) * 100) : 0,
      };
    })
    .filter((p) => p.discountPrice < p.price)
    .sort((a, b) => b.off - a.off);
}
