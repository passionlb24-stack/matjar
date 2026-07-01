import { createClient } from "@/lib/supabase/server";

export type OfferProduct = {
  id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  storeId: string;
  storeName: string;
  off: number; // discount percentage (0 when merchant-flagged without a discount)
};

// Active offers of active stores: products with a discount OR flagged "in_offers"
// by the merchant. RLS already limits to publicly visible products.
export async function getOffers(limit = 60): Promise<OfferProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, price, discount_price, image_url, store_id, in_offers, stores(name)",
    )
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null)
    .or("discount_price.not.is.null,in_offers.eq.true")
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    store_id: string;
    in_offers: boolean;
    stores: { name: string } | null;
  }[];

  return rows
    .map((r) => {
      const price = Number(r.price);
      const discountPrice =
        r.discount_price != null ? Number(r.discount_price) : null;
      return {
        id: r.id,
        name: r.name,
        price,
        discountPrice,
        imageUrl: r.image_url,
        storeId: r.store_id,
        storeName: r.stores?.name ?? "",
        off:
          discountPrice != null && price > 0
            ? Math.round((1 - discountPrice / price) * 100)
            : 0,
      };
    })
    // Drop invalid discounts (>= price) but keep merchant-flagged ones.
    .filter((p) => p.discountPrice == null || p.discountPrice < p.price)
    .sort((a, b) => b.off - a.off);
}

// Products the merchant flagged for clearance (التصفية).
export async function getClearance(limit = 60): Promise<OfferProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, price, discount_price, image_url, store_id, stores(name)",
    )
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null)
    .eq("in_clearance", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    store_id: string;
    stores: { name: string } | null;
  }[];

  return rows.map((r) => {
    const price = Number(r.price);
    const discountPrice =
      r.discount_price != null ? Number(r.discount_price) : null;
    return {
      id: r.id,
      name: r.name,
      price,
      discountPrice,
      imageUrl: r.image_url,
      storeId: r.store_id,
      storeName: r.stores?.name ?? "",
      off:
        discountPrice != null && price > 0
          ? Math.round((1 - discountPrice / price) * 100)
          : 0,
    };
  });
}
