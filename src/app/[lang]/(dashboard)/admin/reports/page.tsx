import { notFound } from "next/navigation";
import {
  BarChart3,
  ShoppingBag,
  CalendarCheck,
  Crown,
  TrendingUp,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { regions } from "@/lib/catalog";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { MiniBars } from "@/components/ui/sparkline";

type Row = { label: string; value: number };

// A distribution card: a MiniBars chart of the values up top for an at-a-glance
// shape, then the ranked bar list underneath for exact figures.
function DistributionCard({
  title,
  rows,
  empty,
  tone = "text-primary",
}: {
  title: string;
  rows: Row[];
  empty: string;
  tone?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
        {rows.length > 1 && (
          <MiniBars
            values={rows.map((r) => r.value)}
            width={96}
            height={30}
            className={tone}
          />
        )}
      </div>
      {rows.length ? (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{r.label}</span>
                <span className="font-bold tabular-nums">
                  {r.value.toLocaleString("en-US")}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </Card>
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

  return (
    <div className="py-10">
      <Container>
        <PageHeader icon={BarChart3} title={t.title} subtitle={t.subtitle} />

        <div data-animate className="space-y-6">
          <StatGrid>
            <Stat
              label={t.totalOrders}
              value={(report.total_orders ?? 0).toLocaleString("en-US")}
              icon={<ShoppingBag />}
            />
            <Stat
              label={t.totalBookings}
              value={(report.total_bookings ?? 0).toLocaleString("en-US")}
              icon={<CalendarCheck />}
            />
            <Stat
              label={t.proStores}
              value={(report.pro_stores ?? 0).toLocaleString("en-US")}
              icon={<Crown />}
            />
            <Stat
              label={t.conversion}
              value={`${report.conversion ?? 0}%`}
              icon={<TrendingUp />}
            />
          </StatGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <DistributionCard
              title={t.storesByStatus}
              rows={byStatus}
              empty={t.noData}
            />
            <DistributionCard
              title={t.usersByRole}
              rows={byRole}
              empty={t.noData}
              tone="text-info"
            />
            <DistributionCard
              title={t.storesByRegion}
              rows={byRegion}
              empty={t.noData}
              tone="text-success"
            />
            <DistributionCard
              title={t.storesByType}
              rows={byType}
              empty={t.noData}
              tone="text-warning"
            />
            <DistributionCard
              title={t.topStores}
              rows={topStores}
              empty={t.noData}
              tone="text-primary"
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
