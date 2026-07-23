import { notFound } from "next/navigation";
import { Palette } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import {
  AdminModerationClient,
  type ModerationItem,
} from "@/components/admin-moderation-client";

export default async function AdminFreelancePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("gigs")
    .select(
      "id, title, freelancer_name, category, price, region, image_url, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    freelancer_name: string | null;
    category: string | null;
    price: number | null;
    region: string | null;
    image_url: string | null;
    status: string;
    created_at: string;
  }[];

  const items: ModerationItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    author: r.freelancer_name,
    meta:
      [r.category, r.region, r.price != null ? `$${r.price}` : null]
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
      table="gigs"
      icon={Palette}
      title={dict.admin.freelance.title}
      subtitle={dict.admin.freelance.subtitle}
      viewBase="freelance"
      items={items}
    />
  );
}
