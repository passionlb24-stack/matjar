import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isPro } from "@/lib/plan";
import { getStorePlan } from "@/lib/plan-server";
import { ProGate } from "@/components/pro-gate";
import type { CategoryKey } from "@/lib/catalog";
import { sectorConfig } from "@/lib/sectors";
import { Container } from "@/components/ui/container";
import {
  CrmManager,
  type BookCustomer,
  type DerivedCustomer,
} from "@/components/crm-manager";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderRow = {
  customer_id: string | null;
  customer_name: string | null;
  phone: string | null;
  total: number;
};

// CRM module of the Business OS: the merchant's customer book + customers
// derived from orders. The page title speaks the sector's language (patients
// for clinics, leads for real estate…).
export default async function StoreCustomersPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: canManage } = await supabase.rpc("can_manage_store", {
    p_store_id: storeId,
  });
  if (!canManage) redirect(`/${lang}/merchant`);

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, owner_id, business_types(slug)")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  // Pro-only module: free stores see the upsell instead.
  if (!isPro(await getStorePlan(storeId))) {
    return <ProGate lang={lang} dict={dict} storeId={storeId} />;
  }

  // CRM contains customer data + spend: staff need the orders permission.
  const isOwner =
    (store as unknown as { owner_id: string }).owner_id === user.id;
  if (!isOwner) {
    const { data: staffRow } = await supabase
      .from("store_staff")
      .select("permissions")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .maybeSingle();
    const perms =
      (staffRow?.permissions as Record<string, boolean> | null) ?? {};
    if (!(perms.orders ?? false)) redirect(`/${lang}/merchant/${storeId}`);
  }
  const category =
    ((store as unknown as { business_types: { slug: string } | null })
      .business_types?.slug as CategoryKey) ?? "retail";
  const noun = dict.os.nouns[sectorConfig[category].customersNoun];

  const [{ data: bookData }, { data: ordersData }] = await Promise.all([
    supabase
      .from("store_customers")
      .select("id, name, phone, notes, status, follow_up_on")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("customer_id, customer_name, phone, total")
      .eq("store_id", storeId),
  ]);
  const book = (bookData ?? []) as BookCustomer[];

  // Aggregate order rows into unique customers (guest orders group by phone).
  const map = new Map<string, DerivedCustomer>();
  ((ordersData ?? []) as OrderRow[]).forEach((o) => {
    const key = o.customer_id ?? o.phone ?? "anon";
    const c = map.get(key) ?? { name: null, phone: null, count: 0, total: 0 };
    c.count += 1;
    c.total += Number(o.total);
    if (!c.name && o.customer_name) c.name = o.customer_name;
    if (!c.phone && o.phone) c.phone = o.phone;
    map.set(key, c);
  });
  const derived = [...map.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="py-10">
      <Container className="max-w-3xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {(store as { name: string }).name}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{noun}</h1>

        <div className="mt-6">
          <CrmManager
            storeId={storeId}
            dict={dict}
            book={book}
            derived={derived}
          />
        </div>
      </Container>
    </div>
  );
}
