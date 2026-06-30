import { createClient } from "@/lib/supabase/server";

export type BestSeller = {
  id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  storeId: string;
  storeName: string;
  sold: number;
};

// Top products by ordered quantity (via the SECURITY DEFINER get_best_sellers
// RPC, which safely aggregates the RLS-protected order_items).
export async function getBestSellers(limit = 24): Promise<BestSeller[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_best_sellers", { p_limit: limit });
  const rows = (data ?? []) as {
    id: string;
    name: string;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    store_id: string;
    store_name: string;
    sold: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: Number(r.price),
    discountPrice: r.discount_price != null ? Number(r.discount_price) : null,
    imageUrl: r.image_url,
    storeId: r.store_id,
    storeName: r.store_name,
    sold: Number(r.sold),
  }));
}
