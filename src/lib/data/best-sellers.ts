import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-client";

export type BestSeller = {
  id: string;
  name: string;
  nameEn: string | null;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  storeId: string;
  storeName: string;
  sold: number;
};

// Top products by ordered quantity (via the SECURITY DEFINER get_best_sellers
// RPC, which safely aggregates the RLS-protected order_items). Public + identical
// for everyone, so cached cross-request with the cookie-less client; the RPC is
// SECURITY DEFINER so it runs fine under the anon role. Tagged "products".
export const getBestSellers = unstable_cache(
  async (limit = 24): Promise<BestSeller[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase.rpc("get_best_sellers", { p_limit: limit });
    const rows = (data ?? []) as {
      id: string;
      name: string;
      name_en: string | null;
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
      // NOTE: get_best_sellers RPC (migration 0031) does not yet return name_en,
      // so this is null until that function is updated to select p.name_en.
      nameEn: r.name_en ?? null,
      price: Number(r.price),
      discountPrice: r.discount_price != null ? Number(r.discount_price) : null,
      imageUrl: r.image_url,
      storeId: r.store_id,
      storeName: r.store_name,
      sold: Number(r.sold),
    }));
  },
  ["best-sellers"],
  { revalidate: 300, tags: ["products"] },
);
