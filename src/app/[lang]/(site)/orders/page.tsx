import { notFound, redirect } from "next/navigation";
import { Package } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";

type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "rejected";

type OrderRow = {
  id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  stores: { name: string } | null;
};

const statusStyle: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-sky-100 text-sky-700",
  preparing: "bg-sky-100 text-sky-700",
  ready: "bg-emerald-100 text-emerald-700",
  out_for_delivery: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
  rejected: "bg-red-100 text-red-700",
};

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase
    .from("orders")
    .select("id, status, total, created_at, stores(name)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <div className="py-10">
      <Container className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.orders.title}
        </h1>

        {orders.length ? (
          <div className="mt-8 space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5"
              >
                <div>
                  <p className="font-bold">{order.stores?.name ?? "—"}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {dict.orders.order} #{order.id.slice(0, 8)} ·{" "}
                    {formatPrice(order.total)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusStyle[order.status]}`}
                >
                  {dict.orders.status[order.status]}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Package className="h-7 w-7" />
            </span>
            <p className="mt-4 text-muted-foreground">{dict.orders.empty}</p>
          </div>
        )}
      </Container>
    </div>
  );
}
