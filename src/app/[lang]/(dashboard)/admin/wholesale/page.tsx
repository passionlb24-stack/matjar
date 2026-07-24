import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import {
  AdminModerationClient,
  type ModerationItem,
} from "@/components/admin-moderation-client";

export default async function AdminWholesalePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("wholesale", lang);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("wholesale_products")
    .select(
      "id, title, seller_name, category, unit, moq, price, region, image_url, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    seller_name: string | null;
    category: string | null;
    unit: string | null;
    moq: number | null;
    price: number | null;
    region: string | null;
    image_url: string | null;
    status: string;
    created_at: string;
  }[];

  const items: ModerationItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    author: r.seller_name,
    meta:
      [
        r.category,
        r.region,
        r.price != null ? `$${r.price}${r.unit ? `/${r.unit}` : ""}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    image: r.image_url,
    status: r.status,
    createdAt: r.created_at,
  }));

  return (
    <AdminModerationClient
      lang={lang}
      dict={dict}
      table="wholesale_products"
      title={dict.admin.wholesale.title}
      subtitle={dict.admin.wholesale.subtitle}
      viewBase="wholesale"
      items={items}
    />
  );
}
