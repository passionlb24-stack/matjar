import { createClient } from "@/lib/supabase/server";

export type OfferProduct = {
  id: string;
  name: string;
  nameEn: string | null;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  storeId: string;
  storeName: string;
  off: number; // discount percentage (0 when merchant-flagged without a discount)
};

// Deal of the Day — the single product an admin/merchant flagged for today.
// Drives the home-page countdown section (a daily reason to come back).
export async function getDailyDeal(): Promise<OfferProduct | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, name_en, price, discount_price, image_url, store_id, stores(name)",
    )
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null)
    .eq("deal_date", new Date().toISOString().slice(0, 10))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as {
    id: string;
    name: string;
    name_en: string | null;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    store_id: string;
    stores: { name: string } | null;
  };
  const price = Number(r.price);
  const discountPrice = r.discount_price != null ? Number(r.discount_price) : null;
  return {
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
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
}

// Active offers of active stores: products with a discount OR flagged "in_offers"
// by the merchant. RLS already limits to publicly visible products.
export async function getOffers(limit = 60): Promise<OfferProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, name_en, price, discount_price, image_url, store_id, in_offers, stores(name)",
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
    name_en: string | null;
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
        nameEn: r.name_en,
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
      "id, name, name_en, price, discount_price, image_url, store_id, stores(name)",
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
    name_en: string | null;
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
      nameEn: r.name_en,
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
