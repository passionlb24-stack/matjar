import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import { AdminStoresClient, type AdminStore } from "@/components/admin-stores-client";

type StoreRow = {
  id: string;
  name: string;
  owner_id: string;
  region: string | null;
  status: "pending" | "active" | "suspended" | "rejected";
  plan: "free" | "pro";
  is_verified: boolean;
  featured_until: string | null;
  commercial_reg_no: string | null;
  commercial_reg_verified: boolean;
  business_types: { name_ar: string; name_en: string } | null;
};

export default async function AdminStoresPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("stores", lang);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select(
      "id, name, owner_id, region, status, plan, is_verified, featured_until, commercial_reg_no, commercial_reg_verified, business_types(name_ar, name_en)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as StoreRow[];

  // Resolve owner names in one round-trip.
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const ownerMap = new Map<string, string>();
  if (ownerIds.length) {
    const { data: owners } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    for (const o of (owners ?? []) as { id: string; full_name: string | null }[]) {
      if (o.full_name) ownerMap.set(o.id, o.full_name);
    }
  }

  const stores: AdminStore[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    region: r.region,
    status: r.status,
    plan: r.plan,
    isVerified: r.is_verified,
    featuredUntil: r.featured_until,
    commercialRegNo: r.commercial_reg_no,
    commercialRegVerified: r.commercial_reg_verified,
    typeName: r.business_types
      ? lang === "ar"
        ? r.business_types.name_ar
        : r.business_types.name_en
      : null,
    ownerName: ownerMap.get(r.owner_id) ?? null,
  }));

  return <AdminStoresClient lang={lang} dict={dict} stores={stores} />;
}
