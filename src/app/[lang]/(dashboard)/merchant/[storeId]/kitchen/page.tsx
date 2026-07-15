import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, ChefHat } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { KitchenBoard, type KitchenOrder } from "@/components/kitchen-board";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Kitchen display (restaurant deep pack): live board of active orders.
export default async function StoreKitchenPage({
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

  // Staff need the orders permission to work the kitchen board.
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

  // Oldest first — the kitchen works the queue in order.
  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, fulfillment, customer_name, customer_note, created_at, order_items(name, quantity)",
    )
    .eq("store_id", storeId)
    .in("status", ["pending", "accepted", "preparing", "ready"])
    .order("created_at", { ascending: true });
  const orders = (data ?? []) as unknown as KitchenOrder[];

  return (
    <div className="py-8">
      <Container className="max-w-6xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {(store as { name: string }).name}
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <ChefHat className="h-7 w-7 text-primary" />
          {dict.os.kitchen.title}
        </h1>

        <div className="mt-6">
          <KitchenBoard dict={dict} orders={orders} />
        </div>
      </Container>
    </div>
  );
}
