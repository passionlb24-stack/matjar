import "server-only";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public-client";
import type { CategoryKey } from "@/lib/catalog";
import type { Variant, AddOn } from "@/components/product-order";

// The public product view: the product row + its store context + variants +
// add-ons. Identical for every anonymous visitor, so it's cached cross-request
// with the cookie-less anon client. Per-user pieces (wishlist, saved address,
// reviews, "is store owner"…) stay on the request-scoped client in the page.
export type ProductView = {
  id: string;
  storeId: string;
  storeName: string;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  category: CategoryKey;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  price: number;
  discountPrice: number | null;
  flashPrice: number | null;
  flashStart: string | null;
  flashEnd: string | null;
  stock: number | null;
  images: string[];
  attributes: Record<string, string> | null;
  variants: Variant[];
  addons: AddOn[];
};

// Client-agnostic fetch + map. `supabase` is the anon public client on the
// cached path, or the request-scoped server client on the owner/staff fallback.
// RLS decides visibility; the query is identical either way.
async function fetchProductView(
  supabase: SupabaseClient,
  id: string,
): Promise<ProductView | null> {
  const { data } = await supabase
    .from("products")
    .select(
      "id, store_id, name, name_en, description, description_en, price, discount_price, flash_price, flash_start, flash_end, image_url, gallery, stock, attributes, stores(name, accepts_delivery, accepts_pickup, business_types(slug))",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;

  const store = data.stores as unknown as {
    name: string;
    accepts_delivery: boolean | null;
    accepts_pickup: boolean | null;
    business_types: { slug: string } | null;
  } | null;

  const [{ data: variants }, { data: addons }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, label, price, stock, is_available")
      .eq("product_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_options")
      .select("id, name, price")
      .eq("product_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  const gallery = Array.isArray(data.gallery) ? (data.gallery as string[]) : [];
  const images = [data.image_url as string | null, ...gallery].filter(
    Boolean,
  ) as string[];

  return {
    id: data.id as string,
    storeId: data.store_id as string,
    storeName: store?.name ?? "",
    acceptsDelivery: store?.accepts_delivery ?? true,
    acceptsPickup: store?.accepts_pickup ?? true,
    category: (store?.business_types?.slug as CategoryKey) ?? "retail",
    name: data.name as string,
    nameEn: (data.name_en as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    descriptionEn: (data.description_en as string | null) ?? null,
    price: Number(data.price),
    discountPrice:
      data.discount_price != null ? Number(data.discount_price) : null,
    flashPrice: data.flash_price != null ? Number(data.flash_price) : null,
    flashStart: (data.flash_start as string | null) ?? null,
    flashEnd: (data.flash_end as string | null) ?? null,
    stock: data.stock != null ? Number(data.stock) : null,
    images,
    attributes: (data.attributes as Record<string, string> | null) ?? null,
    variants: (variants ?? []).map((v) => ({
      id: v.id as string,
      label: v.label as string,
      price: v.price != null ? Number(v.price) : null,
      stock: v.stock != null ? Number(v.stock) : null,
      is_available: v.is_available as boolean,
    })),
    addons: (addons ?? []).map((a) => ({
      id: a.id as string,
      name: a.name as string,
      price: Number(a.price),
    })),
  };
}

// Cached public read: anon client, so RLS returns the product only when it and
// its store are active — the set that's safe to share across visitors. Tagged
// product:<id> (targeted bust on edit) plus the shared "products" tag.
export function getPublicProductView(id: string): Promise<ProductView | null> {
  return unstable_cache(
    () => fetchProductView(createPublicClient(), id),
    ["product-view", id],
    { revalidate: 300, tags: ["products", `product:${id}`] },
  )();
}

// Uncached fallback on the request-scoped client, used only when the cached
// public read returns null — an owner/staff previewing a not-yet-public product.
// Never cached: visibility here is per-user.
export function getOwnedProductView(
  supabase: SupabaseClient,
  id: string,
): Promise<ProductView | null> {
  return fetchProductView(supabase, id);
}
