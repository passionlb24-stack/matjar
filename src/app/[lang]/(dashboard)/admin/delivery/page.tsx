import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import {
  AdminDeliveryClient,
  type DeliveryCompany,
} from "@/components/admin-delivery-client";

export default async function AdminDeliveryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("delivery", lang);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_companies")
    .select("id, name, coverage, phone, whatsapp, pricing_note, is_active")
    .order("created_at", { ascending: false });

  return (
    <AdminDeliveryClient
      dict={dict}
      companies={(data ?? []) as DeliveryCompany[]}
    />
  );
}
