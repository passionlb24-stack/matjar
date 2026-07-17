import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isPro } from "@/lib/plan";
import { getStorePlan } from "@/lib/plan-server";
import { ProGate } from "@/components/pro-gate";
import { Container } from "@/components/ui/container";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// Stacked daily-revenue columns: online (brand blue) under POS (amber).
// Pure CSS — percentage heights inside a fixed-height flex column.
function RevenueColumns({
  days,
  legendOnline,
  legendPos,
  hasPos,
}: {
  days: { label: string; online: number; pos: number }[];
  legendOnline: string;
  legendPos: string;
  hasPos: boolean;
}) {
  const max = Math.max(1, ...days.map((d) => d.online + d.pos));
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: 150 }}>
        {days.map((d) => {
          const total = d.online + d.pos;
          return (
            <div
              key={d.label}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${d.label} — $${Number(total.toFixed(2)).toLocaleString("en-US")}`}
            >
              {d.pos > 0 && (
                <div
                  className={`w-full rounded-t-md bg-amber-400`}
                  style={{ height: `${(d.pos / max) * 100}%` }}
                />
              )}
              {d.online > 0 && (
                <div
                  className={`w-full bg-primary ${d.pos > 0 ? "" : "rounded-t-md"}`}
                  style={{ height: `${(d.online / max) * 100}%` }}
                />
              )}
              {total === 0 && (
                <div className="h-1 w-full rounded-t-md bg-surface-muted" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        {days.map((d, i) => (
          <span
            key={d.label}
            className="flex-1 text-center text-[9px] font-medium text-muted-foreground"
          >
            {i % 2 === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      {hasPos && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
            {legendOnline}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
            {legendPos}
          </span>
        </div>
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
    .select("id, name, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  // Pro-only module: free stores see the upsell instead.
  if (!isPro(await getStorePlan(storeId))) {
    return <ProGate lang={lang} dict={dict} storeId={storeId} />;
  }

  // Revenue data: staff need the orders permission.
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

  // Everything is aggregated server-side (see migration 0087) so revenue can't
  // silently truncate past PostgREST's 1000-row cap as a store grows.
  const { data: report } = await supabase.rpc("store_report", {
    p_store_id: storeId,
    p_days: 14,
  });
  const r = (report ?? {}) as {
    total_orders?: number;
    online_sales?: number;
    pos_total?: number;
    week?: { count: number; pct: number };
    month?: { count: number; pct: number };
    per_day?: { day: string; orders: number; online: number; pos: number }[];
    status_rows?: { status: string; count: number }[];
    top_products?: { name: string; qty: number }[];
  };

  const totalSales = Number(r.online_sales ?? 0) + Number(r.pos_total ?? 0);

  const dayLabel = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(
      lang === "ar" ? "ar" : "en",
      { month: "numeric", day: "numeric" },
    );
  const perDay = (r.per_day ?? []).map((d) => ({
    label: dayLabel(d.day),
    value: Number(d.orders),
  }));
  const revenueDays = (r.per_day ?? []).map((d) => ({
    label: dayLabel(d.day),
    online: Number(d.online),
    pos: Number(d.pos),
  }));
  const statusRows = (r.status_rows ?? []).map((s) => ({
    label: (dict.orders.status as Record<string, string>)[s.status] ?? s.status,
    value: Number(s.count),
  }));
  const topProducts = (r.top_products ?? []).map((tp) => ({
    label: tp.name,
    value: Number(tp.qty),
  }));

  const kpis = [
    { label: t.totalOrders, value: String(r.total_orders ?? 0) },
    { label: t.sales, value: formatPrice(totalSales) },
    {
      label: t.thisWeek,
      value: String(r.week?.count ?? 0),
      pct: r.week?.pct ?? 0,
    },
    {
      label: t.thisMonth,
      value: String(r.month?.count ?? 0),
      pct: r.month?.pct ?? 0,
    },
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

        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-bold text-muted-foreground">
            {t.revenueDaily}
          </h2>
          <div className="mt-4">
            <RevenueColumns
              days={revenueDays}
              legendOnline={dict.os.finance.online}
              legendPos={dict.os.finance.pos}
              hasPos={Number(r.pos_total ?? 0) > 0}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Bars title={t.ordersOverTime} rows={perDay} empty={t.noData} />
          <Bars title={t.statusBreakdown} rows={statusRows} empty={t.noData} />
          <Bars title={t.topProducts} rows={topProducts} empty={t.noData} />
        </div>
      </Container>
    </div>
  );
}
