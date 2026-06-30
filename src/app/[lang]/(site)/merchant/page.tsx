import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, Store as StoreIcon } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";

type StoreRow = {
  id: string;
  name: string;
  status: "pending" | "active" | "suspended" | "rejected";
  area: string | null;
  business_types: { name_ar: string; name_en: string } | null;
};

const statusStyle: Record<StoreRow["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-slate-100 text-slate-600",
  rejected: "bg-red-100 text-red-700",
};

export default async function MerchantPage({
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
    .from("stores")
    .select("id, name, status, area, business_types(name_ar, name_en)")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const stores = (data ?? []) as unknown as StoreRow[];

  const storeIds = stores.map((s) => s.id);
  let stats = { today: 0, total: 0, sales: 0, pending: 0, bookings: 0 };
  if (storeIds.length) {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("total, status, created_at")
      .in("store_id", storeIds);
    const { count: bookingCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("store_id", storeIds);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const orders = (ordersData ?? []) as {
      total: number;
      status: string;
      created_at: string;
    }[];
    stats = {
      today: orders.filter((o) => new Date(o.created_at) >= startOfDay).length,
      total: orders.length,
      sales: orders.reduce((s, o) => s + Number(o.total), 0),
      pending: orders.filter((o) => o.status === "pending").length,
      bookings: bookingCount ?? 0,
    };
  }

  return (
    <div className="py-10">
      <Container>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {dict.merchant.dashboardTitle}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {dict.merchant.dashboardSubtitle}
            </p>
          </div>
          <Link
            href={`/${lang}/merchant/new`}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            {dict.merchant.newStore}
          </Link>
        </div>

        {storeIds.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: dict.merchant.stats.todayOrders, value: stats.today },
              { label: dict.merchant.stats.pending, value: stats.pending },
              { label: dict.merchant.stats.totalOrders, value: stats.total },
              {
                label: dict.merchant.stats.sales,
                value: `$${stats.sales.toLocaleString("en-US")}`,
              },
              { label: dict.merchant.stats.bookings, value: stats.bookings },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-surface-muted/60 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {stores.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <div
                key={store.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold leading-tight">{store.name}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[store.status]}`}
                  >
                    {dict.merchant.status[store.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {store.business_types
                    ? lang === "ar"
                      ? store.business_types.name_ar
                      : store.business_types.name_en
                    : null}
                  {store.area ? ` · ${store.area}` : null}
                </p>
                <Link
                  href={`/${lang}/merchant/${store.id}`}
                  className="mt-4 inline-block rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                >
                  {dict.merchant.manage}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <StoreIcon className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold">
              {dict.merchant.noStoresTitle}
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
              {dict.merchant.noStoresBody}
            </p>
            <Link
              href={`/${lang}/merchant/new`}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" />
              {dict.merchant.newStore}
            </Link>
          </div>
        )}
      </Container>
    </div>
  );
}
