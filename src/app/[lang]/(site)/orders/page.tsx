import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Package, ChevronLeft } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

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

const statusVariant: Record<
  OrderStatus,
  "neutral" | "primary" | "success" | "warning" | "danger" | "info"
> = {
  pending: "warning",
  accepted: "info",
  preparing: "info",
  ready: "success",
  out_for_delivery: "info",
  completed: "success",
  cancelled: "neutral",
  rejected: "danger",
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
    <div className="pb-16">
      <PageHero title={dict.orders.title} icon={Package} />
      <Container className="max-w-3xl py-8">
        {orders.length ? (
          <div data-animate className="space-y-3">
            {orders.map((order) => (
              <Card key={order.id} variant="interactive" className="p-0">
                <Link
                  href={`/${lang}/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {order.stores?.name ?? "—"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {dict.orders.order} #{order.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-primary">
                      {formatPrice(order.total)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={statusVariant[order.status]}>
                      {dict.orders.status[order.status]}
                    </Badge>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title={dict.orders.empty}
            action={{ href: `/${lang}/explore`, label: dict.common.explore }}
          />
        )}
      </Container>
    </div>
  );
}
