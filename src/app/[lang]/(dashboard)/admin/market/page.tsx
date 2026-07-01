import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import {
  AdminMarketClient,
  type AdminListing,
} from "@/components/admin-market-client";

export default async function AdminMarketPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "id, title, price, city, region, status, is_featured, images, created_at, stores(name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    price: number;
    city: string | null;
    region: string | null;
    status: AdminListing["status"];
    is_featured: boolean;
    images: string[] | null;
    created_at: string;
    stores: { name: string } | null;
  }[];

  const listings: AdminListing[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    price: Number(r.price),
    city: r.city,
    region: r.region,
    status: r.status,
    isFeatured: r.is_featured,
    image: Array.isArray(r.images) && r.images.length ? r.images[0] : null,
    storeName: r.stores?.name ?? null,
    createdAt: r.created_at,
  }));

  return <AdminMarketClient lang={lang} dict={dict} listings={listings} />;
}
