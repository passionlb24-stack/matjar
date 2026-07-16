import { notFound } from "next/navigation";
import { Receipt, TrendingUp, Undo2, Coins } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { OrderPayments, type OrderPayment } from "@/components/order-payments";

type OrderRow = {
  id: string;
  status: string;
  total: number;
  customer_name: string | null;
  phone: string | null;
  created_at: string;
  stores: { name: string } | null;
};

function money(n: number) {
  return n >= 1000 ? `$${Number(n).toLocaleString("en-US")}` : `$${n}`;
}

// Admin reconciliation: platform-wide payment/refund totals + the same per-order
// ledger merchants use (admins are authorized by the RPC + RLS, so refunds work
// here too). The super_admin gate lives in the admin layout.
export default async function AdminOrdersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.admin.ordersAdmin;

  const supabase = await createClient();

  // Platform-wide money totals (append-only ledger; cheap aggregate).
  const { data: ledger } = await supabase
    .from("order_payments")
    .select("kind, amount");
  let collected = 0;
  let refunded = 0;
  ((ledger ?? []) as { kind: "payment" | "refund"; amount: number }[]).forEach(
    (p) => {
      if (p.kind === "refund") refunded += Number(p.amount);
      else collected += Number(p.amount);
    },
  );

  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true });

  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, total, customer_name, phone, created_at, stores(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const orders = (data ?? []) as unknown as OrderRow[];

  // Ledger rows for the listed orders, grouped by order id.
  const orderIds = orders.map((o) => o.id);
  const { data: payData } = orderIds.length
    ? await supabase
        .from("order_payments")
        .select("id, order_id, kind, amount, method, note, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true })
    : { data: [] };
  const paymentsByOrder = new Map<string, OrderPayment[]>();
  ((payData ?? []) as (OrderPayment & { order_id: string })[]).forEach((p) => {
    const list = paymentsByOrder.get(p.order_id) ?? [];
    list.push(p);
    paymentsByOrder.set(p.order_id, list);
  });

  const cards = [
    {
      Icon: TrendingUp,
      label: t.totalCollected,
      value: money(collected),
      tone: "text-emerald-600",
    },
    {
      Icon: Undo2,
      label: t.totalRefunded,
      value: money(refunded),
      tone: "text-red-600",
    },
    {
      Icon: Coins,
      label: t.netRevenue,
      value: money(collected - refunded),
      tone: "text-foreground",
    },
    {
      Icon: Receipt,
      label: t.orderCount,
      value: String(orderCount ?? 0),
      tone: "text-primary",
    },
  ];

  return (
    <div className="py-10">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <c.Icon className={`h-5 w-5 ${c.tone}`} />
              <div className={`mt-2 text-2xl font-extrabold ${c.tone}`}>
                {c.value}
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                {c.label}
              </div>
            </div>
          ))}
        </div>

        {orders.length ? (
          <div className="mt-8 space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 font-semibold text-muted-foreground">
                    #{order.id.slice(0, 8)}
                    <span className="ms-2 font-bold text-foreground">
                      {order.stores?.name ?? "—"}
                    </span>
                    {order.customer_name && (
                      <span className="ms-2">· {order.customer_name}</span>
                    )}
                  </span>
                  <span className="font-bold">{money(order.total)}</span>
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
            {t.empty}
          </div>
        )}
      </Container>
    </div>
  );
}
