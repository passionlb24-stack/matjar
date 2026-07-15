import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import type { CategoryKey } from "@/lib/catalog";
import {
  getSector,
  OS_GROUPS,
  OS_MODULE_META,
  type OsModuleKey,
} from "@/lib/sectors";
import { SITE_URL } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { StoreShareCard } from "@/components/store-share-card";
import {
  StoreChecklist,
  type ChecklistState,
} from "@/components/store-checklist";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ===== Matjar Business OS — store home =====
// The hub every merchant lands on. Renders entirely from the sector registry:
// the same core platform shows a restaurant its orders and menu, a clinic its
// appointments and doctors — one codebase, sector-shaped.
export default async function StoreOsHomePage({
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
    .select(
      "id, name, owner_id, short_code, logo_url, cover_url, description, opening_hours, whatsapp, business_types(slug, name_ar, name_en)",
    )
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  const s = store as unknown as {
    name: string;
    owner_id: string;
    short_code: string;
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

  // Owner sees every module; staff only what they were granted.
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
  const canSee = (key: OsModuleKey) => {
    const meta = OS_MODULE_META[key];
    if (isOwner) return true;
    if (meta.ownerOnly) return false;
    return meta.perm ? (perms[meta.perm] ?? false) : true;
  };

  // Live pulse (cheap head-count queries).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [pendingOrdersRes, todayOrdersRes, pendingBookingsRes, itemsRes] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "pending"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .gte("created_at", startOfToday.toISOString()),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "pending"),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .is("deleted_at", null),
    ]);
  const pendingOrders = pendingOrdersRes.count ?? 0;
  const pendingBookings = pendingBookingsRes.count ?? 0;
  const itemsCount = itemsRes.count ?? 0;

  const isCommerce = sector.flow.kind === "commerce";
  const kpis = [
    isCommerce
      ? {
          label: dict.merchant.kpi.pendingOrders,
          value: pendingOrders,
          href: `/${lang}/merchant/${storeId}/orders`,
          highlight: pendingOrders > 0,
        }
      : {
          label: dict.merchant.kpi.pendingBookings,
          value: pendingBookings,
          href: `/${lang}/merchant/${storeId}/bookings`,
          highlight: pendingBookings > 0,
        },
    {
      label: dict.merchant.kpi.todayOrders,
      value: todayOrdersRes.count ?? 0,
      href: `/${lang}/merchant/${storeId}/orders`,
      highlight: false,
    },
    isCommerce
      ? {
          label: dict.merchant.kpi.pendingBookings,
          value: pendingBookings,
          href: `/${lang}/merchant/${storeId}/bookings`,
          highlight: pendingBookings > 0,
        }
      : {
          label: dict.merchant.kpi.pendingOrders,
          value: pendingOrders,
          href: `/${lang}/merchant/${storeId}/orders`,
          highlight: pendingOrders > 0,
        },
  ];

  // Attention badges on module tiles.
  const badges: Partial<Record<OsModuleKey, number>> = {
    orders: pendingOrders,
    bookings: pendingBookings,
  };

  const moduleLabel: Record<OsModuleKey, string> = {
    orders: dict.merchant.ordersLink,
    bookings: dict.merchant.bookingsLink,
    items: dict.store[sector.flow.itemsKey],
    doctors: dict.merchant.doctorsLink,
    customers: dict.os.nouns[sector.customersNoun],
    staff: dict.merchant.staffLink,
    reports: dict.merchant.analytics.link,
    accounting: dict.merchant.accounting.link,
    coupons: dict.merchant.coupons.link,
    subscription: dict.merchant.subscriptionLink,
    settings: dict.merchant.settingsLink,
    edit: dict.merchant.edit,
  };

  // Onboarding checklist (owner nudge until the store is complete).
  const checklist: ChecklistState = {
    logo: !!s.logo_url,
    cover: !!s.cover_url,
    description: !!s.description?.trim(),
    hours: !!s.opening_hours?.trim(),
    whatsapp: !!s.whatsapp?.trim(),
    products: itemsCount >= 3,
  };
  const checklistComplete = Object.values(checklist).every(Boolean);

  const SectorIcon = sector.Icon;

  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-4xl">
        <Link
          href={`/${lang}/merchant`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.merchant.products.back}
        </Link>

        {/* Sector-tinted hero: the store's identity + one-line mission. */}
        <div
          className={`mt-4 overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${sector.heroTint} bg-surface p-6 sm:p-7`}
        >
          <div className="flex flex-wrap items-center gap-4">
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

          {/* Live pulse */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {kpis.map((k) => (
              <Link
                key={k.label}
                href={k.href}
                className={`rounded-2xl border p-4 backdrop-blur transition-colors ${
                  k.highlight
                    ? "border-primary/40 bg-primary-soft"
                    : "border-border/70 bg-surface/80 hover:bg-surface"
                }`}
              >
                <div
                  className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${k.highlight ? "text-primary" : ""}`}
                >
                  {k.value}
                </div>
                <div className="mt-1 text-xs font-semibold text-muted-foreground">
                  {k.label}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {isOwner && !checklistComplete && (
          <div className="mt-6">
            <StoreChecklist
              lang={lang}
              dict={dict}
              storeId={storeId}
              state={checklist}
            />
          </div>
        )}

        {/* OS modules, grouped — rendered straight from the sector registry. */}
        {OS_GROUPS.map((group) => {
          const visible = sector.modules[group].filter(canSee);
          if (!visible.length) return null;
          return (
            <section key={group} className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {dict.os.groups[group]}
              </h2>
              <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {visible.map((key) => {
                  const meta = OS_MODULE_META[key];
                  const badge = badges[key] ?? 0;
                  return (
                    <Link
                      key={key}
                      href={`/${lang}/merchant/${storeId}/${meta.path}`}
                      className="group relative flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-transform group-hover:scale-105">
                        <meta.Icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-semibold leading-tight">
                        {moduleLabel[key]}
                      </span>
                      {badge > 0 && (
                        <span className="absolute end-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div className="mt-8">
          <StoreShareCard code={s.short_code} baseUrl={SITE_URL} dict={dict} />
        </div>
      </Container>
    </div>
  );
}
