import { createClient } from "@/lib/supabase/server";
import type { CategoryKey } from "@/lib/catalog";

export type RelatedProduct = {
  id: string;
  name: string;
  nameEn: string | null;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  storeName: string;
};

function mapRows(
  rows: {
    id: string;
    name: string;
    name_en: string | null;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    stores: { name: string } | null;
  }[],
): RelatedProduct[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
    price: Number(r.price),
    discountPrice: r.discount_price != null ? Number(r.discount_price) : null,
    imageUrl: r.image_url,
    storeName: r.stores?.name ?? "",
  }));
}

/** Products most frequently bought in the same order as this one. */
export async function getBoughtTogether(
  productId: string,
): Promise<RelatedProduct[]> {
  const supabase = await createClient();
  const { data: rpc } = await supabase.rpc("bought_together", {
    p_product_id: productId,
    p_limit: 4,
  });
  const ids = ((rpc ?? []) as { product_id: string }[]).map((r) => r.product_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("products")
    .select("id, name, name_en, price, discount_price, image_url, stores(name)")
    .in("id", ids)
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null);
  const mapped = mapRows(
    (data ?? []) as unknown as Parameters<typeof mapRows>[0],
  );
  // Preserve the co-purchase frequency order.
  const order = new Map(ids.map((id, i) => [id, i]));
  return mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Other active products from the same store. */
export async function getMoreFromStore(
  storeId: string,
  excludeId: string,
  limit = 6,
): Promise<RelatedProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, name_en, price, discount_price, image_url, stores(name)")
    .eq("store_id", storeId)
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null)
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return mapRows((data ?? []) as unknown as Parameters<typeof mapRows>[0]);
}

/** Active products in the same sector (business type) from other stores. */
export async function getSimilarProducts(
  category: CategoryKey,
  excludeStoreId: string,
  excludeId: string,
  limit = 6,
): Promise<RelatedProduct[]> {
  const supabase = await createClient();
  const { data: bt } = await supabase
    .from("business_types")
    .select("id")
    .eq("slug", category)
    .limit(1)
    .maybeSingle();
  const btId = (bt as { id?: string } | null)?.id;
  if (!btId) return [];

  const { data } = await supabase
    .from("products")
    .select(
      "id, name, name_en, price, discount_price, image_url, store_id, stores!inner(name, status, business_type_id)",
    )
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null)
    .eq("stores.status", "active")
    .eq("stores.business_type_id", btId)
    .neq("id", excludeId)
    .neq("store_id", excludeStoreId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return mapRows((data ?? []) as unknown as Parameters<typeof mapRows>[0]);
}
