import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import {
  BusinessTypeManager,
  type BusinessType,
} from "@/components/business-type-manager";

export default async function AdminBusinessTypesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("types", lang);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("business_types")
    .select("id, slug, name_ar, name_en, icon, sort_order, is_active")
    .order("sort_order", { ascending: true });
  const types = (data ?? []) as BusinessType[];

  return <BusinessTypeManager lang={lang} dict={dict} types={types} />;
}
