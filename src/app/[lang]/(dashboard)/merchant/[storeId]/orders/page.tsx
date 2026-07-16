import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Printer } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { AutoRefresh } from "@/components/auto-refresh";
import { OrderStatusControl } from "@/components/order-status-control";
import { OrderPayments, type OrderPayment } from "@/components/order-payments";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderItem = { name: string; quantity: number; unit_price: number };
type OrderRow = {
  id: string;
  status: string;
  total: number;
  fulfillment: "delivery" | "pickup";
  address: string | null;
  phone: string | null;
  customer_name: string | null;
  customer_note: string | null;
  created_at: string;
  order_items: OrderItem[];
};

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

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
      "id, status, total, fulfillment, address, phone, customer_name, customer_note, created_at, order_items(name, quantity, unit_price)",
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as unknown as OrderRow[];

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
          <div className="mt-8 space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0 text-sm font-semibold text-muted-foreground">
                    {dict.orders.order} #{order.id.slice(0, 8)}
                    {order.customer_name && (
                      <span className="ms-2 font-bold text-foreground">
                        {order.customer_name}
                      </span>
                    )}
                    <span className="ms-2 text-xs">
                      {new Date(order.created_at).toLocaleString(
                        lang === "ar" ? "ar" : "en",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/${lang}/merchant/${storeId}/orders/${order.id}/invoice`}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {dict.os.invoice.link}
                    </Link>
                    <OrderStatusControl
                      orderId={order.id}
                      status={order.status}
                      labels={dict.orders.status}
                      errorLabel={dict.auth.errorGeneric}
                    />
                  </span>
                </div>
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  {order.order_items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span>
                        {item.quantity}× {item.name}
                      </span>
                      <span className="text-muted-foreground">
                        {formatPrice(item.unit_price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold">
                  <span>{dict.orders.total}</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
                <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                  <p>
                    {order.fulfillment === "delivery"
                      ? dict.store.delivery
                      : dict.store.pickup}
                    {order.phone ? ` · ${order.phone}` : ""}
                  </p>
                  {order.address && <p>{order.address}</p>}
                  {order.customer_note && (
                    <p className="italic">“{order.customer_note}”</p>
                  )}
                </div>
                <OrderPayments
                  orderId={order.id}
                  payments={paymentsByOrder.get(order.id) ?? []}
                  dict={dict}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {dict.merchant.noOrders}
          </div>
        )}
      </Container>
    </div>
  );
}
