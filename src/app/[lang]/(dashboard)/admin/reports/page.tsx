import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { regions } from "@/lib/catalog";
import { Container } from "@/components/ui/container";

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
  // Both the headline KPIs and the distribution bars are aggregated server-side
  // (super_admin gated). Counting rows fetched into the page silently truncated
  // past PostgREST's 1000-row cap, so totals and breakdowns — especially users by
  // role, from the large profiles table — read low at scale with no error. The
  // RPCs compute every figure with unbounded aggregates in one round-trip each.
  const [reportRes, distRes] = await Promise.all([
    supabase.rpc("admin_platform_report"),
    supabase.rpc("admin_report_distributions"),
  ]);

  const report = (reportRes.data ?? {}) as {
    total_orders?: number;
    total_bookings?: number;
    pro_stores?: number;
    conversion?: number;
  };
  const dist = (distRes.data ?? {}) as {
    by_status?: { status: string; count: number }[];
    by_region?: { region: string; count: number }[];
    by_type?: { name_ar: string; name_en: string; count: number }[];
    by_role?: { role: string; count: number }[];
    top_stores?: { name: string; count: number }[];
  };

  const regionName = (key: string) =>
    regions.find((r) => r.key === key)?.name[l] ?? key;

  const byStatus = (dist.by_status ?? []).map((r) => ({
    label:
      (dict.admin.storesAdmin.statusLabels as Record<string, string>)[
        r.status
      ] ?? r.status,
    value: r.count,
  }));
  const byRegion = (dist.by_region ?? []).map((r) => ({
    label: regionName(r.region),
    value: r.count,
  }));
  const byType = (dist.by_type ?? []).map((r) => ({
    label: l === "ar" ? r.name_ar : r.name_en,
    value: r.count,
  }));
  const byRole = (dist.by_role ?? []).map((r) => ({
    label: (dict.admin.usersAdmin.roles as Record<string, string>)[r.role] ??
      r.role,
    value: r.count,
  }));
  const topStores = (dist.top_stores ?? []).map((r) => ({
    label: r.name,
    value: r.count,
  }));

  const kpis = [
    { label: t.totalOrders, value: report.total_orders ?? 0 },
    { label: t.totalBookings, value: report.total_bookings ?? 0 },
    { label: t.proStores, value: report.pro_stores ?? 0 },
    { label: t.conversion, value: `${report.conversion ?? 0}%` },
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
