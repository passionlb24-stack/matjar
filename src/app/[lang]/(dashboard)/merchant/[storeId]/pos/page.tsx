import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, ReceiptText } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isPro } from "@/lib/plan";
import { getStorePlan } from "@/lib/plan-server";
import { ProGate } from "@/components/pro-gate";
import { Container } from "@/components/ui/container";
import {
  PosTerminal,
  type PosProduct,
  type PosCustomer,
} from "@/components/pos-terminal";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmt(n: number) {
  return `$${Number(n.toFixed(2)).toLocaleString("en-US")}`;
}

// POS module of the Business OS: record in-store sales against the catalog.
export default async function StorePosPage({
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
    .select("id, name, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  // Pro-only module: free stores see the upsell instead.
  if (!isPro(await getStorePlan(storeId))) {
    return <ProGate lang={lang} dict={dict} storeId={storeId} />;
  }

  // Staff need the orders permission to sell.
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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [{ data: productsData }, { data: customersData }, { data: todayData }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, price, discount_price, image_url, stock")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("store_customers")
        .select("id, name")
        .eq("store_id", storeId)
        .order("name"),
      supabase
        .from("pos_sales")
        .select("total")
        .eq("store_id", storeId)
        .gte("created_at", startOfToday.toISOString()),
    ]);

  const todaySales = (todayData ?? []) as { total: number }[];
  const todayTotal = todaySales.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="py-10">
      <Container className="max-w-5xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {(store as { name: string }).name}
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {dict.os.pos.title}
          </h1>
          <span className="flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-bold text-primary">
            <ReceiptText className="h-4 w-4" />
            {dict.os.pos.todaySales}: {todaySales.length} · {fmt(todayTotal)}
          </span>
        </div>

        <div className="mt-6">
          <PosTerminal
            storeId={storeId}
            dict={dict}
            products={(productsData ?? []) as PosProduct[]}
            customers={(customersData ?? []) as PosCustomer[]}
          />
        </div>
      </Container>
    </div>
  );
}
