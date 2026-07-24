import "server-only";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public-client";
import type { CategoryKey } from "@/lib/catalog";

// The public store view: the store row + its active catalogue + sections. This
// is the heaviest, most-visited public read on the site (the store page is the
// top SEO surface), and it's identical for every anonymous visitor — so it's
// cached cross-request with the cookie-less anon client, exactly like the
// homepage's fetchActiveStores. Per-user pieces (follow state, reviews, saved
// addresses…) stay on the request-scoped client in the page and are never
// cached here.
export type StoreView = {
  name: string;
  slug?: string | null;
  accentColor?: string | null;
  storefrontLayout?: "grid" | "menu" | "showcase" | null;
  category: CategoryKey;
  area: string | null;
  description: string | null;
  isOpen: boolean;
  plan?: "free" | "pro";
  rating?: number;
  reviews?: number;
  logoUrl?: string | null;
  coverUrl?: string | null;
  openingHours?: string | null;
  hours?: unknown;
  bookingSlotMinutes?: number;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
  minOrder?: number | null;
  prepTime?: string | null;
  paymentNote?: string | null;
  specialties?: string | null;
  insurance?: string | null;
  registered?: boolean;
  loyaltyRedemptionEnabled?: boolean;
  loyaltyPointsPerUnit?: number | null;
  lat?: number | null;
  lng?: number | null;
  isReal: boolean;
  sections: {
    id: string;
    name: string;
    nameEn: string | null;
    sortOrder: number;
  }[];
  products: {
    id?: string;
    name: string;
    nameEn?: string | null;
    descriptionEn?: string | null;
    price: number;
    discountPrice?: number | null;
    imageUrl?: string | null;
    attributes?: Record<string, string> | null;
    flashPrice?: number | null;
    flashStart?: string | null;
    flashEnd?: string | null;
    stock?: number | null;
    sectionId?: string | null;
  }[];
};

// Client-agnostic fetch + map. `supabase` may be the anon public client (for the
// cached path) or the request-scoped server client (for the owner/admin fallback
// below). RLS decides visibility either way; the query itself is identical.
async function fetchStoreView(
  supabase: SupabaseClient,
  id: string,
): Promise<StoreView | null> {
  const { data } = await supabase
    .from("stores")
    .select(
      "name, slug, description, area, status, plan, logo_url, cover_url, phone, whatsapp, opening_hours, hours, booking_slot_minutes, instagram, facebook, website, accepts_delivery, accepts_pickup, min_order, prep_time, payment_note, specialties, insurance, commercial_reg_verified, loyalty_redemption_enabled, loyalty_points_per_unit, accent_color, storefront_layout, lat, lng, business_types(slug)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;

  const bt = data.business_types as unknown as { slug: string } | null;
  const { data: prods } = await supabase
    .from("products")
    .select(
      "id, name, name_en, description_en, price, discount_price, image_url, attributes, flash_price, flash_start, flash_end, stock, section_id",
    )
    .eq("store_id", id)
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  // Storefront sections: the store groups its catalog into named sections
  // (menu groups / collections / service groups). None → flat list.
  const { data: sects } = await supabase
    .from("store_sections")
    .select("id, name, name_en, sort_order")
    .eq("store_id", id)
    .order("sort_order", { ascending: true });

  return {
    name: data.name as string,
    slug: (data.slug as string | null) ?? null,
    accentColor: (data.accent_color as string | null) ?? null,
    storefrontLayout:
      (data.storefront_layout as "grid" | "menu" | "showcase" | null) ?? null,
    category: (bt?.slug as CategoryKey) ?? "retail",
    area: (data.area as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    isOpen: data.status === "active",
    plan: (data.plan as "free" | "pro" | null) ?? "free",
    logoUrl: (data.logo_url as string | null) ?? null,
    coverUrl: (data.cover_url as string | null) ?? null,
    openingHours: (data.opening_hours as string | null) ?? null,
    hours: data.hours as unknown,
    bookingSlotMinutes: (data.booking_slot_minutes as number | null) ?? 30,
    instagram: (data.instagram as string | null) ?? null,
    facebook: (data.facebook as string | null) ?? null,
    website: (data.website as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    whatsapp: (data.whatsapp as string | null) ?? null,
    acceptsDelivery: (data.accepts_delivery as boolean | null) ?? true,
    acceptsPickup: (data.accepts_pickup as boolean | null) ?? true,
    minOrder: data.min_order != null ? Number(data.min_order) : null,
    prepTime: (data.prep_time as string | null) ?? null,
    paymentNote: (data.payment_note as string | null) ?? null,
    specialties: (data.specialties as string | null) ?? null,
    insurance: (data.insurance as string | null) ?? null,
    registered: (data.commercial_reg_verified as boolean | null) ?? false,
    loyaltyRedemptionEnabled:
      (data.loyalty_redemption_enabled as boolean | null) ?? false,
    loyaltyPointsPerUnit:
      data.loyalty_points_per_unit != null
        ? Number(data.loyalty_points_per_unit)
        : null,
    lat: data.lat != null ? Number(data.lat) : null,
    lng: data.lng != null ? Number(data.lng) : null,
    isReal: true,
    sections: (sects ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      nameEn: (s.name_en as string | null) ?? null,
      sortOrder: (s.sort_order as number | null) ?? 0,
    })),
    products: (prods ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      nameEn: (p.name_en as string | null) ?? null,
      descriptionEn: (p.description_en as string | null) ?? null,
      price: Number(p.price),
      discountPrice: p.discount_price != null ? Number(p.discount_price) : null,
      imageUrl: (p.image_url as string | null) ?? null,
      attributes: (p.attributes as Record<string, string> | null) ?? null,
      flashPrice: p.flash_price != null ? Number(p.flash_price) : null,
      flashStart: (p.flash_start as string | null) ?? null,
      flashEnd: (p.flash_end as string | null) ?? null,
      stock: p.stock != null ? Number(p.stock) : null,
      sectionId: (p.section_id as string | null) ?? null,
    })),
  };
}

// Cached public read: anon client, so RLS returns the store only when it's
// active + not deleted — the exact set that's safe to share across visitors.
// Tagged store:<id> (targeted bust on edit) plus the shared "stores" tag.
export function getPublicStoreView(id: string): Promise<StoreView | null> {
  return unstable_cache(
    () => fetchStoreView(createPublicClient(), id),
    ["store-view", id],
    { revalidate: 300, tags: ["stores", `store:${id}`] },
  )();
}

// Uncached fallback on the request-scoped client, used only when the cached
// public read returns null — i.e. an owner or admin previewing a store that
// isn't publicly visible yet (draft/pending). Their RLS grant makes it visible;
// it must never be cached because visibility here is per-user.
export function getOwnedStoreView(
  supabase: SupabaseClient,
  id: string,
): Promise<StoreView | null> {
  return fetchStoreView(supabase, id);
}
