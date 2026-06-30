import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { OrderStatusControl } from "@/components/order-status-control";

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
  customer_note: string | null;
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
      "id, status, total, fulfillment, address, phone, customer_note, order_items(name, quantity, unit_price)",
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as unknown as OrderRow[];

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
                  <span className="text-sm font-semibold text-muted-foreground">
                    {dict.orders.order} #{order.id.slice(0, 8)}
                  </span>
                  <OrderStatusControl
                    orderId={order.id}
                    status={order.status}
                    labels={dict.orders.status}
                  />
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
