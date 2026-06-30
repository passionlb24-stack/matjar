import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEAD = new Set(["cancelled", "rejected"]);
const DAY = 86_400_000;

function formatPrice(n: number) {
  return n >= 1000 ? `$${Number(n).toLocaleString("en-US")}` : `$${n}`;
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
                <span className="truncate font-medium">{r.label}</span>
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

function Delta({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold ${up ? "text-emerald-600" : "text-red-600"}`}
    >
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {Math.abs(pct)}%
    </span>
  );
}

export default async function StoreReportsPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);
  const t = dict.merchant.analytics;

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

  const [{ data: ordersData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, status, created_at")
      .eq("store_id", storeId),
    supabase
      .from("order_items")
      .select("name, quantity, orders!inner(store_id)")
      .eq("orders.store_id", storeId),
  ]);
  const orders = (ordersData ?? []) as {
    id: string;
    total: number;
    status: string;
    created_at: string;
  }[];
  const items = (itemsData ?? []) as unknown as {
    name: string;
    quantity: number;
  }[];

  const now = Date.now();
  const live = orders.filter((o) => !DEAD.has(o.status));
  const totalSales = live.reduce((s, o) => s + Number(o.total), 0);

  const inRange = (o: { created_at: string }, from: number, to: number) => {
    const ts = new Date(o.created_at).getTime();
    return ts >= from && ts < to;
  };
  const windowStats = (days: number) => {
    const cur = orders.filter((o) => inRange(o, now - days * DAY, now));
    const prev = orders.filter((o) =>
      inRange(o, now - 2 * days * DAY, now - days * DAY),
    );
    const curN = cur.length;
    const prevN = prev.length;
    const pct = prevN > 0 ? Math.round(((curN - prevN) / prevN) * 100) : curN > 0 ? 100 : 0;
    return { count: curN, pct };
  };
  const week = windowStats(7);
  const month = windowStats(30);

  // Orders per day, last 14 days.
  const perDay: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = now - i * DAY;
    const count = orders.filter((o) =>
      inRange(o, dayStart - (dayStart % DAY), dayStart - (dayStart % DAY) + DAY),
    ).length;
    const d = new Date(dayStart);
    perDay.push({
      label: d.toLocaleDateString(lang === "ar" ? "ar" : "en", {
        month: "numeric",
        day: "numeric",
      }),
      value: count,
    });
  }

  const statusRows = [...orders.reduce((m, o) => {
    m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return m;
  }, new Map<string, number>())].map(([k, v]) => ({
    label: (dict.orders.status as Record<string, string>)[k] ?? k,
    value: v,
  }));

  const topProducts = [...items.reduce((m, it) => {
    m.set(it.name, (m.get(it.name) ?? 0) + Number(it.quantity));
    return m;
  }, new Map<string, number>())]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const kpis = [
    { label: t.totalOrders, value: String(orders.length) },
    { label: t.sales, value: formatPrice(totalSales) },
    { label: t.thisWeek, value: String(week.count), pct: week.pct },
    { label: t.thisMonth, value: String(month.count), pct: month.pct },
  ];

  return (
    <div className="py-10">
      <Container className="max-w-4xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {(store as { name: string }).name}
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <BarChart3 className="h-7 w-7 text-primary" />
          {t.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl bg-surface-muted/60 p-4">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
                {k.value}
                {"pct" in k && typeof k.pct === "number" && <Delta pct={k.pct} />}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Bars title={t.ordersOverTime} rows={perDay} empty={t.noData} />
          <Bars title={t.statusBreakdown} rows={statusRows} empty={t.noData} />
          <Bars title={t.topProducts} rows={topProducts} empty={t.noData} />
        </div>
      </Container>
    </div>
  );
}
