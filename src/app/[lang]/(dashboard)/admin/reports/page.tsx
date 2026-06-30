import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { regions } from "@/lib/catalog";
import { Container } from "@/components/ui/container";

type StoreRow = {
  id: string;
  name: string;
  status: string;
  region: string | null;
  plan: string;
  business_types: { name_ar: string; name_en: string } | null;
};

function tally<T>(items: T[], key: (t: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function Bars({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; value: number }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
      {rows.length ? (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{r.label}</span>
                <span className="font-bold">{r.value}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

export default async function AdminReportsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.admin.reports;
  const l = lang as Locale;

  const supabase = await createClient();
  const [storesRes, profilesRes, ordersRes, bookingsRes] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name, status, region, plan, business_types(name_ar, name_en)")
      .is("deleted_at", null),
    supabase.from("profiles").select("role"),
    supabase.from("orders").select("store_id"),
    supabase.from("bookings").select("id", { count: "exact", head: true }),
  ]);

  const stores = (storesRes.data ?? []) as unknown as StoreRow[];
  const profiles = (profilesRes.data ?? []) as { role: string }[];
  const orders = (ordersRes.data ?? []) as { store_id: string }[];
  const bookingsCount = bookingsRes.count ?? 0;

  const regionName = (key: string) =>
    regions.find((r) => r.key === key)?.name[l] ?? key;

  const byStatus = [...tally(stores, (s) => s.status)].map(([k, v]) => ({
    label:
      (dict.admin.storesAdmin.statusLabels as Record<string, string>)[k] ?? k,
    value: v,
  }));
  const byRegion = [...tally(stores, (s) => s.region)]
    .map(([k, v]) => ({ label: regionName(k), value: v }))
    .sort((a, b) => b.value - a.value);
  const byType = [...tally(stores, (s) =>
    s.business_types ? (l === "ar" ? s.business_types.name_ar : s.business_types.name_en) : null,
  )]
    .map(([k, v]) => ({ label: k, value: v }))
    .sort((a, b) => b.value - a.value);
  const byRole = [...tally(profiles, (p) => p.role)].map(([k, v]) => ({
    label: (dict.admin.usersAdmin.roles as Record<string, string>)[k] ?? k,
    value: v,
  }));

  const proCount = stores.filter((s) => s.plan === "pro").length;
  const activeCount = stores.filter((s) => s.status === "active").length;
  const conversion = activeCount ? Math.round((proCount / activeCount) * 100) : 0;

  const orderByStore = tally(orders, (o) => o.store_id);
  const topStores = stores
    .map((s) => ({ label: s.name, value: orderByStore.get(s.id) ?? 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const kpis = [
    { label: t.totalOrders, value: orders.length },
    { label: t.totalBookings, value: bookingsCount },
    { label: t.proStores, value: proCount },
    { label: t.conversion, value: `${conversion}%` },
  ];

  return (
    <div className="py-10">
      <Container>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
        </div>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl bg-surface-muted/60 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {k.label}
              </p>
              <p className="mt-1 text-2xl font-extrabold">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Bars title={t.storesByStatus} rows={byStatus} empty={t.noData} />
          <Bars title={t.usersByRole} rows={byRole} empty={t.noData} />
          <Bars title={t.storesByRegion} rows={byRegion} empty={t.noData} />
          <Bars title={t.storesByType} rows={byType} empty={t.noData} />
          <Bars title={t.topStores} rows={topStores} empty={t.noData} />
        </div>
      </Container>
    </div>
  );
}
