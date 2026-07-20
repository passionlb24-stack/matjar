import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, ExternalLink, BarChart3, Sun } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import type { CategoryKey } from "@/lib/catalog";
import { getSector } from "@/lib/sectors";
import { SITE_URL } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { StoreShareCard } from "@/components/store-share-card";
import {
  StoreChecklist,
  type ChecklistState,
} from "@/components/store-checklist";
import { Stat } from "@/components/os-dashboard/stat";
import { WidgetCard } from "@/components/os-dashboard/widget-card";
import { RevenueChart } from "@/components/os-dashboard/revenue-chart";
import {
  TodayPanel,
  type TodayCounterRow,
  type TodayBookingRow,
} from "@/components/os-dashboard/today-panel";
import {
  AlertsCard,
  type AlertRow,
} from "@/components/os-dashboard/alerts-card";
import {
  ActivityFeed,
  type ActivityRow,
} from "@/components/os-dashboard/activity-feed";
import {
  TasksWidget,
  type TaskRow,
} from "@/components/os-dashboard/tasks-widget";
import {
  SuggestionsCard,
  type SuggestionRow,
} from "@/components/os-dashboard/suggestions-card";
import {
  QuickActions,
  type QuickAction,
  type QuickActionKey,
} from "@/components/os-dashboard/quick-actions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmtMoney = (n: number) =>
  `$${Number(Number(n).toFixed(2)).toLocaleString("en-US")}`;

// ===== The dashboard's building blocks, ordered per sector =====
// Same widgets everywhere — a clinic and a boutique share one codebase — but
// each sector leads with what its day actually revolves around. Ordering is
// data, not copy-pasted JSX.
type WidgetKey =
  | "kpis"
  | "chart"
  | "today"
  | "alerts"
  | "suggestions"
  | "tasks"
  | "activity";

const WIDGET_ORDER: Record<
  "commerce" | "food" | "booking" | "services",
  WidgetKey[]
> = {
  // Shops & showrooms: money first, then what needs attention.
  commerce: ["kpis", "chart", "alerts", "today", "suggestions", "tasks", "activity"],
  // Restaurants: the pass comes first — orders & kitchen, then the numbers.
  food: ["today", "kpis", "chart", "alerts", "suggestions", "tasks", "activity"],
  // Clinics & agents: today's appointments are the whole morning.
  booking: ["today", "kpis", "alerts", "suggestions", "activity", "tasks", "chart"],
  // Service pros: open requests (quotes to send!) lead, bookings right behind.
  services: ["today", "kpis", "alerts", "suggestions", "activity", "tasks", "chart"],
};

// ===== Matjar Business OS — store home =====
// Not a launcher anymore (the sidebar owns navigation) — a living, sector-aware
// dashboard: real revenue, today's work, honest alerts and suggestions.
export default async function StoreOsHomePage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);
  const t = dict.os.dashboard;

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
    .select(
      "id, name, slug, accent_color, owner_id, short_code, plan, trial_ends_at, logo_url, cover_url, description, opening_hours, whatsapp, business_types(slug, name_ar, name_en)",
    )
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  const s = store as unknown as {
    name: string;
    slug: string | null;
    accent_color: string | null;
    owner_id: string;
    short_code: string;
    plan: "free" | "pro" | null;
    trial_ends_at: string | null;
    logo_url: string | null;
    cover_url: string | null;
    description: string | null;
    opening_hours: string | null;
    whatsapp: string | null;
    business_types: { slug: string; name_ar: string; name_en: string } | null;
  };
  const category = (s.business_types?.slug as CategoryKey) ?? "retail";
  const sector = getSector(category);
  const typeName =
    (lang === "ar" ? s.business_types?.name_ar : s.business_types?.name_en) ??
    "";

  // Owner sees everything; staff only what their permissions grant. Revenue
  // figures are strictly owner-or-orders-permission — never leaked to others.
  const isOwner = s.owner_id === user.id;
  let perms: Record<string, boolean> = {};
  if (!isOwner) {
    const { data: staffRow } = await supabase
      .from("store_staff")
      .select("permissions")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .maybeSingle();
    perms = (staffRow?.permissions as Record<string, boolean> | null) ?? {};
  }
  const canOrders = isOwner || (perms.orders ?? false);
  const canBookings = isOwner || (perms.bookings ?? false);
  const canProducts = isOwner || (perms.products ?? false);
  const canRevenue = canOrders;

  const allModules = new Set(Object.values(sector.modules).flat());
  const hasOrders = allModules.has("orders");
  const hasBookings = allModules.has("bookings");
  const hasRequests = allModules.has("requests");
  const hasKitchen = allModules.has("kitchen");
  const hasInventory = allModules.has("inventory");

  // "Today" in the merchant's timezone (Lebanon platform), for booking dates.
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
  }).format(new Date());
  const since14d = new Date(Date.now() - 14 * 86400_000).toISOString();

  // Everything in one round-trip: the report RPC (aggregated server-side, see
  // 0087/0111) + cheap head-counts and limit≤8 lists, each gated by permission
  // and by whether this sector even has the module.
  const none = { data: null, count: null } as const;
  const [
    reportRes,
    itemsRes,
    pendingOrdersRes,
    pendingBookingsRes,
    todayBookingsCountRes,
    todayBookingsRes,
    pendingRequestsRes,
    lowStockRes,
    tasksRes,
    tasksCountRes,
    recentOrdersRes,
    recentBookingsRes,
    autoRunsRes,
    campaigns14Res,
    automationsCountRes,
    followersRes,
  ] = await Promise.all([
    canRevenue
      ? supabase.rpc("store_report", { p_store_id: storeId, p_days: 14 })
      : Promise.resolve(none),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .is("deleted_at", null),
    canOrders && hasOrders
      ? supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("status", "pending")
      : Promise.resolve(none),
    canBookings && hasBookings
      ? supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("status", "pending")
      : Promise.resolve(none),
    canBookings && hasBookings
      ? supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("requested_date", todayIso)
          .in("status", ["pending", "accepted", "scheduled"])
      : Promise.resolve(none),
    canBookings && hasBookings
      ? supabase
          .from("bookings")
          .select("id, service_name, requested_time, customer_name")
          .eq("store_id", storeId)
          .eq("requested_date", todayIso)
          .in("status", ["pending", "accepted", "scheduled"])
          .order("requested_time", { ascending: true, nullsFirst: false })
          .limit(5)
      : Promise.resolve(none),
    canBookings && hasRequests
      ? supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("status", "pending")
      : Promise.resolve(none),
    canProducts && hasInventory
      ? supabase
          .from("products")
          .select("id, name, stock")
          .eq("store_id", storeId)
          .is("deleted_at", null)
          .not("stock", "is", null)
          .lte("stock", 5)
          .order("stock", { ascending: true })
          .limit(5)
      : Promise.resolve(none),
    supabase
      .from("store_tasks")
      .select("id, title, priority, due_on")
      .eq("store_id", storeId)
      .eq("status", "open")
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("store_tasks")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "open"),
    canOrders && hasOrders
      ? supabase
          .from("orders")
          .select("id, total, status, customer_name, created_at")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve(none),
    canBookings && hasBookings
      ? supabase
          .from("bookings")
          .select("id, service_name, customer_name, created_at")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(3)
      : Promise.resolve(none),
    canOrders
      ? supabase
          .from("automation_runs")
          .select("id, trigger, created_at")
          .eq("store_id", storeId)
          .eq("status", "fired")
          .order("created_at", { ascending: false })
          .limit(3)
      : Promise.resolve(none),
    isOwner
      ? supabase
          .from("store_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .gte("created_at", since14d)
      : Promise.resolve(none),
    isOwner
      ? supabase
          .from("automations")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
      : Promise.resolve(none),
    isOwner
      ? supabase
          .from("follows")
          .select("user_id", { count: "exact", head: true })
          .eq("store_id", storeId)
      : Promise.resolve(none),
  ]);

  const report = (reportRes.data ?? null) as {
    total_orders?: number;
    online_realized?: number;
    online_pending?: number;
    pos_total?: number;
    week?: { count: number; pct: number };
    month?: { count: number; pct: number };
    per_day?: { day: string; orders: number; online: number; pos: number }[];
  } | null;

  const itemsCount = itemsRes.count ?? 0;
  const pendingOrders = pendingOrdersRes.count ?? 0;
  const pendingBookings = pendingBookingsRes.count ?? 0;
  const todayBookingsCount = todayBookingsCountRes.count ?? 0;
  const pendingRequests = pendingRequestsRes.count ?? 0;
  const openTasks = tasksCountRes.count ?? 0;
  const lowStock = (lowStockRes.data ?? []) as {
    id: string;
    name: string;
    stock: number;
  }[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const todayBookings = (todayBookingsRes.data ?? []) as {
    id: string;
    service_name: string | null;
    requested_time: string | null;
    customer_name: string | null;
  }[];
  const recentOrders = (recentOrdersRes.data ?? []) as {
    id: string;
    total: number;
    status: string;
    customer_name: string | null;
    created_at: string;
  }[];
  const recentBookings = (recentBookingsRes.data ?? []) as {
    id: string;
    service_name: string | null;
    customer_name: string | null;
    created_at: string;
  }[];
  const autoRuns = (autoRunsRes.data ?? []) as {
    id: string;
    trigger: string;
    created_at: string;
  }[];

  const base = `/${lang}/merchant/${storeId}`;

  // ---- KPI row (revenue strictly gated) ------------------------------------
  const realized =
    Number(report?.online_realized ?? 0) + Number(report?.pos_total ?? 0);
  const pendingRevenue = Number(report?.online_pending ?? 0);
  type StatItem = {
    label: string;
    value: string;
    hint?: string;
    pct?: number;
    href?: string;
    highlight?: boolean;
  };
  let stats: StatItem[] = [];
  if (canRevenue && report) {
    stats = [
      {
        label: t.revenue,
        value: fmtMoney(realized),
        hint: t.revenueHint,
        href: `${base}/reports`,
      },
      {
        label: t.pendingRevenue,
        value: fmtMoney(pendingRevenue),
        hint: t.pendingRevenueHint,
        href: hasOrders ? `${base}/orders` : `${base}/reports`,
        highlight: pendingRevenue > 0,
      },
      {
        label: t.weekOrders,
        value: String(report.week?.count ?? 0),
        pct: report.week?.pct ?? 0,
        href: hasOrders ? `${base}/orders` : `${base}/reports`,
      },
      {
        label: t.monthOrders,
        value: String(report.month?.count ?? 0),
        pct: report.month?.pct ?? 0,
        href: `${base}/reports`,
      },
    ];
  } else if (canBookings) {
    // Bookings-only staff still get a useful pulse — counts, never money.
    stats = [
      {
        label: dict.merchant.kpi.pendingBookings,
        value: String(pendingBookings),
        href: `${base}/bookings`,
        highlight: pendingBookings > 0,
      },
      {
        label: t.todayBookings,
        value: String(todayBookingsCount),
        href: `${base}/bookings`,
      },
      ...(hasRequests
        ? [
            {
              label: t.todayRequests,
              value: String(pendingRequests),
              href: `${base}/requests`,
              highlight: pendingRequests > 0,
            },
          ]
        : []),
    ];
  }

  // ---- Revenue chart -------------------------------------------------------
  const dayLabel = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(
      lang === "ar" ? "ar" : "en",
      { month: "numeric", day: "numeric" },
    );
  const perDay = report?.per_day ?? [];
  const chartDays = perDay.map((d, i) => ({
    label: dayLabel(d.day),
    online: Number(d.online),
    pos: Number(d.pos),
    isToday: i === perDay.length - 1,
    tooltip: `${dayLabel(d.day)} — ${fmtMoney(Number(d.online) + Number(d.pos))}`,
  }));
  const showChart =
    canRevenue &&
    !!report &&
    (sector.flow.kind === "commerce" || realized + pendingRevenue > 0);

  // ---- Today panel ---------------------------------------------------------
  const counters: TodayCounterRow[] = [];
  if (canOrders && hasOrders)
    counters.push({
      key: "orders",
      label: t.todayPendingOrders,
      count: pendingOrders,
      href: `${base}/orders`,
    });
  if (canOrders && hasKitchen)
    counters.push({
      key: "kitchen",
      label: t.todayKitchen,
      count: null,
      href: `${base}/kitchen`,
    });
  if (canBookings && hasRequests)
    counters.push({
      key: "requests",
      label: t.todayRequests,
      count: pendingRequests,
      href: `${base}/requests`,
    });
  const bookingRows: TodayBookingRow[] | null =
    canBookings && hasBookings
      ? todayBookings.map((b) => ({
          id: b.id,
          time: b.requested_time ? b.requested_time.slice(0, 5) : null,
          customer: b.customer_name || t.customerFallback,
          service: b.service_name,
        }))
      : null;
  const showToday = counters.length > 0 || bookingRows !== null;

  // ---- Alerts (honest ones only) -------------------------------------------
  const alerts: AlertRow[] = [];
  if (isOwner && s.plan === "free" && s.trial_ends_at) {
    const daysLeft =
      (new Date(s.trial_ends_at).getTime() - Date.now()) / 86400_000;
    if (daysLeft >= 0 && daysLeft <= 3) {
      alerts.push({
        id: "trial",
        kind: "trial",
        text: t.trialAlert.replace(
          "{date}",
          new Date(s.trial_ends_at).toLocaleDateString(
            lang === "ar" ? "ar" : "en",
            { month: "long", day: "numeric" },
          ),
        ),
        cta: t.trialCta,
        href: `${base}/subscription`,
      });
    }
  }
  if (canOrders && pendingOrders > 0) {
    alerts.push({
      id: "pending-orders",
      kind: "orders",
      text: t.pendingOrdersAlert.replace("{n}", String(pendingOrders)),
      cta: t.review,
      href: `${base}/orders`,
    });
  }
  for (const p of lowStock) {
    alerts.push({
      id: `stock-${p.id}`,
      kind: "stock",
      text: t.lowStockAlert
        .replace("{name}", p.name)
        .replace("{n}", String(p.stock)),
      cta: t.restock,
      href: `${base}/inventory`,
    });
  }
  const showAlerts = alerts.length > 0 || isOwner;

  // ---- Activity feed (orders + bookings + automation runs, merged) ---------
  const triggerLabels = dict.os.automations.triggers as Record<string, string>;
  const activity: ActivityRow[] = [
    ...recentOrders.map((o) => ({
      id: o.id,
      kind: "order" as const,
      text: `${t.activityOrder} · ${o.customer_name || t.customerFallback}`,
      meta: fmtMoney(Number(o.total)),
      createdAt: o.created_at,
    })),
    ...recentBookings.map((b) => ({
      id: b.id,
      kind: "booking" as const,
      text: `${t.activityBooking} · ${b.customer_name || t.customerFallback}${
        b.service_name ? ` · ${b.service_name}` : ""
      }`,
      createdAt: b.created_at,
    })),
    ...autoRuns.map((a) => ({
      id: a.id,
      kind: "automation" as const,
      text: `${t.activityAutomation} · ${triggerLabels[a.trigger] ?? a.trigger}`,
      createdAt: a.created_at,
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const showActivity = canOrders || canBookings;

  // ---- Smart suggestions (rule-based, from data already on hand) -----------
  const checklist: ChecklistState = {
    logo: !!s.logo_url,
    cover: !!s.cover_url,
    description: !!s.description?.trim(),
    hours: !!s.opening_hours?.trim(),
    whatsapp: !!s.whatsapp?.trim(),
    products: itemsCount >= 3,
    brandColor: !!s.accent_color,
    customLink: !!s.slug,
  };
  const checklistDone = Object.values(checklist).every(Boolean);
  const hasAudience =
    (followersRes.count ?? 0) > 0 || (report?.total_orders ?? 0) > 0;
  const suggestions: SuggestionRow[] = [];
  if (isOwner) {
    if (itemsCount === 0)
      suggestions.push({
        key: "addItem",
        text: t.suggestAddItem,
        cta: t.suggestAddItemCta,
        href: `${base}/items`,
      });
    if (!checklistDone)
      suggestions.push({
        key: "checklist",
        text: t.suggestChecklist,
        cta: t.suggestChecklistCta,
        href: `${base}/edit`,
      });
    if (lowStock.length > 0 && hasInventory)
      suggestions.push({
        key: "restock",
        text: t.suggestRestock,
        cta: t.suggestRestockCta,
        href: `${base}/inventory`,
      });
    if (hasAudience && (campaigns14Res.count ?? 0) === 0)
      suggestions.push({
        key: "campaign",
        text: t.suggestCampaign,
        cta: t.suggestCampaignCta,
        href: `${base}/campaigns`,
      });
    if ((automationsCountRes.count ?? 0) === 0)
      suggestions.push({
        key: "automation",
        text: t.suggestAutomation,
        cta: t.suggestAutomationCta,
        href: `${base}/automations`,
      });
  }
  const topSuggestions = suggestions.slice(0, 3);

  // ---- Quick actions (per sector, permission-filtered) ---------------------
  const quickDefs: Record<
    CategoryKey,
    { key: QuickActionKey; label: string; path: string; perm: string }[]
  > = {
    food: [
      { key: "orders", label: t.quickOrders, path: "orders", perm: "orders" },
      { key: "kitchen", label: t.quickKitchen, path: "kitchen", perm: "orders" },
      { key: "addItem", label: t.quickAddMenuItem, path: "items", perm: "products" },
    ],
    retail: [
      { key: "addItem", label: t.quickAddProduct, path: "items", perm: "products" },
      { key: "pos", label: t.quickPos, path: "pos", perm: "orders" },
      { key: "campaign", label: t.quickCampaign, path: "campaigns", perm: "orders" },
    ],
    services: [
      { key: "bookings", label: t.quickBookings, path: "bookings", perm: "bookings" },
      { key: "requests", label: t.quickRequests, path: "requests", perm: "bookings" },
      { key: "addItem", label: t.quickAddService, path: "items", perm: "products" },
    ],
    healthcare: [
      { key: "bookings", label: t.quickBookings, path: "bookings", perm: "bookings" },
      { key: "requests", label: t.quickRequests, path: "requests", perm: "bookings" },
      { key: "addItem", label: t.quickAddService, path: "items", perm: "products" },
    ],
    realEstate: [
      { key: "addItem", label: t.quickAddListing, path: "items", perm: "products" },
      { key: "bookings", label: t.quickBookings, path: "bookings", perm: "bookings" },
      { key: "campaign", label: t.quickCampaign, path: "campaigns", perm: "orders" },
    ],
    automotive: [
      { key: "addItem", label: t.quickAddListing, path: "items", perm: "products" },
      { key: "orders", label: t.quickOrders, path: "orders", perm: "orders" },
      { key: "campaign", label: t.quickCampaign, path: "campaigns", perm: "orders" },
    ],
  };
  const quickActions: QuickAction[] = quickDefs[category]
    .filter((a) => isOwner || (perms[a.perm] ?? false))
    .map((a) => ({ key: a.key, label: a.label, href: `${base}/${a.path}` }));

  // ---- Layout: same widgets, sector-specific emphasis ----------------------
  const layoutKind =
    category === "food"
      ? "food"
      : sector.flow.kind === "commerce"
        ? "commerce"
        : category === "services"
          ? "services"
          : "booking";
  const order = WIDGET_ORDER[layoutKind];

  const widgets: Record<WidgetKey, React.ReactNode> = {
    kpis:
      stats.length > 0 ? (
        <div
          className={`grid grid-cols-2 gap-3 ${
            stats.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"
          }`}
        >
          {stats.map((k) => (
            <Stat key={k.label} {...k} />
          ))}
        </div>
      ) : null,
    chart: showChart ? (
      <WidgetCard
        title={t.chartTitle}
        Icon={BarChart3}
        action={{ label: dict.merchant.analytics.link, href: `${base}/reports` }}
      >
        <RevenueChart
          days={chartDays}
          legendOnline={dict.os.finance.online}
          legendPos={dict.os.finance.pos}
          todayLabel={t.chartToday}
          hasPos={Number(report?.pos_total ?? 0) > 0}
          empty={t.chartEmpty}
        />
      </WidgetCard>
    ) : null,
    today: showToday ? (
      <WidgetCard title={t.todayTitle} Icon={Sun}>
        <TodayPanel
          counters={counters}
          bookings={bookingRows}
          bookingsTitle={t.todayBookings}
          noBookings={t.todayNoBookings}
          bookingsHref={`${base}/bookings`}
          viewAll={t.viewAll}
          bookingsFirst={layoutKind === "booking"}
        />
      </WidgetCard>
    ) : null,
    alerts: showAlerts ? (
      <AlertsCard title={t.alertsTitle} empty={t.alertsEmpty} alerts={alerts} />
    ) : null,
    suggestions:
      topSuggestions.length > 0 ? (
        <SuggestionsCard title={t.suggestionsTitle} suggestions={topSuggestions} />
      ) : null,
    tasks: (
      <TasksWidget
        title={t.tasksTitle}
        openLabel={t.tasksOpen}
        empty={t.tasksEmpty}
        viewAll={t.tasksAll}
        href={`${base}/tasks`}
        tasks={tasks}
        openCount={openTasks}
        lang={lang}
      />
    ),
    activity: showActivity ? (
      <ActivityFeed
        title={t.activityTitle}
        empty={t.activityEmpty}
        rows={activity}
        lang={lang}
      />
    ) : null,
  };

  const visibleOrder = order.filter((key) => widgets[key] !== null);
  const spanOf = (key: WidgetKey, index: number) =>
    key === "kpis" || key === "chart" || (key === "today" && index === 0)
      ? "lg:col-span-2"
      : "";

  const SectorIcon = sector.Icon;

  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-5xl">
        <div data-animate>
          <Link
            href={`/${lang}/merchant`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            {dict.merchant.products.back}
          </Link>

          {/* Sector-tinted hero: identity + the day's quick actions. */}
          <div
            className={`mt-4 overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${sector.heroTint} bg-surface p-6 sm:p-8`}
          >
            <div className="flex flex-wrap items-center gap-4 sm:gap-5">
              {s.logo_url ? (
                <Image
                  src={s.logo_url}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-2xl border border-border bg-surface object-cover shadow-sm"
                />
              ) : (
                <span
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${sector.iconTint} shadow-sm`}
                >
                  <SectorIcon className="h-8 w-8" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    {s.name}
                  </h1>
                  {typeName && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${sector.iconTint}`}
                    >
                      {typeName}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dict.os.tagline}
                  {itemsCount > 0 && (
                    <span className="ms-2 font-semibold">
                      · {itemsCount} {dict.os.itemsHint}
                    </span>
                  )}
                </p>
              </div>
              <Link
                href={`/${lang}/store/${storeId}`}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface/80 px-4 py-2 text-sm font-bold backdrop-blur transition-colors hover:border-primary hover:text-primary"
              >
                <ExternalLink className="h-4 w-4" />
                {dict.os.viewPublic}
              </Link>
            </div>

            {quickActions.length > 0 && (
              <div className="mt-6">
                <QuickActions actions={quickActions} />
              </div>
            )}
          </div>

          {/* Onboarding checklist (owner nudge until the store is complete). */}
          {isOwner && (
            <div className="mt-6">
              <StoreChecklist
                lang={lang}
                dict={dict}
                storeId={storeId}
                storeName={s.name}
                storeSlug={s.slug}
                state={checklist}
              />
            </div>
          )}

          {/* The living dashboard — widget order follows the sector's day. */}
          <div className="mt-6 grid gap-4 sm:gap-5 lg:grid-cols-2" data-animate>
            {visibleOrder.map((key, index) => (
              <div key={key} className={spanOf(key, index)}>
                {widgets[key]}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <StoreShareCard code={s.short_code} baseUrl={SITE_URL} dict={dict} />
          </div>
        </div>
      </Container>
    </div>
  );
}
