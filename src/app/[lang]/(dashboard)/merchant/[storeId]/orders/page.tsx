import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { AutoRefresh } from "@/components/auto-refresh";
import { type OrderPayment } from "@/components/order-payments";
import { OrdersFilter, type OrderCard } from "@/components/orders-filter";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  note: string | null;
};
type OrderRow = {
  id: string;
  status: string;
  total: number;
  fulfillment: "delivery" | "pickup";
  address: string | null;
  phone: string | null;
  customer_name: string | null;
  customer_note: string | null;
  store_note: string | null;
  created_at: string;
  location_id: string | null;
  order_items: OrderItem[];
  assigned_to: string | null;
  tags: string[] | null;
  delivery_fee: number | null;
  change_for: number | null;
  delivery_instructions: string | null;
  custom_fields: Record<string, string> | null;
  scheduled_for: string | null;
};
type StoreLocation = { id: string; name: string | null; area: string | null };
type TeamMember = { user_id: string; name: string; role: string };

export default async function StoreOrdersPage({
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
    .select("id, name")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, total, fulfillment, address, phone, customer_name, customer_note, store_note, created_at, location_id, assigned_to, tags, delivery_fee, change_for, delivery_instructions, custom_fields, scheduled_for, order_items(name, quantity, unit_price, note)",
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as unknown as OrderRow[];

  // Assignable team (owner + staff, with names) for the per-order assignee
  // picker. One RPC — the merchant page can't read other users' profiles.
  const { data: teamData } = await supabase.rpc("store_team", {
    p_store_id: storeId,
  });
  const team = ((teamData ?? []) as TeamMember[]).map((m) => ({
    id: m.user_id,
    name: m.name,
  }));

  // Branch labels: only shown when the store actually has multiple branches.
  const { data: locData } = await supabase
    .from("store_locations")
    .select("id, name, area")
    .eq("store_id", storeId);
  const locations = (locData ?? []) as StoreLocation[];
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const multiBranch = locations.length > 1;

  // Money ledger for these orders, grouped by order id.
  const { data: payData } = await supabase
    .from("order_payments")
    .select("id, order_id, kind, amount, method, note, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });
  const paymentsByOrder = new Map<string, OrderPayment[]>();
  ((payData ?? []) as (OrderPayment & { order_id: string })[]).forEach((p) => {
    const list = paymentsByOrder.get(p.order_id) ?? [];
    list.push(p);
    paymentsByOrder.set(p.order_id, list);
  });

  // Shape each order for the client filter: resolve its ledger and branch label
  // here so the interactive list can filter/search in memory without refetching.
  const cards: OrderCard[] = orders.map((o) => {
    const loc =
      multiBranch && o.location_id
        ? locationById.get(o.location_id)
        : undefined;
    return {
      ...o,
      tags: o.tags ?? [],
      payments: paymentsByOrder.get(o.id) ?? [],
      branch: loc ? { name: loc.name, area: loc.area } : null,
    };
  });

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
        <AutoRefresh />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {dict.merchant.ordersTitle}
        </h1>

        {orders.length ? (
          <OrdersFilter
            orders={cards}
            dict={dict}
            lang={lang}
            storeId={storeId}
            team={team}
          />
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {dict.merchant.noOrders}
          </div>
        )}
      </Container>
    </div>
  );
}
