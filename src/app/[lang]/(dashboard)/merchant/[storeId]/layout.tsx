import { requestNow } from "@/lib/now";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import type { CategoryKey } from "@/lib/catalog";
import {
  getSector,
  OS_GROUPS,
  OS_MODULE_META,
  sectorTeamMeta,
  type OsModuleKey,
} from "@/lib/sectors";
import {
  hasPlan,
  planRank,
  effectivePlan as resolvePlan,
} from "@/lib/plan-tiers";
import type { MerchantTab } from "@/components/merchant-tab-bar";
import {
  MerchantSidebar,
  type SidebarNav,
} from "@/components/merchant-sidebar";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Modules that live pinned at the sidebar's bottom (Shopify-style: settings
// and account concerns sit below the fold, out of the daily-work groups).
const PINNED: OsModuleKey[] = ["subscription", "settings", "edit"];

// ===== Matjar Business OS — store shell =====
// Wraps every /merchant/[storeId]/* page with the persistent sidebar. Guards
// once (auth + manage rights), resolves the sector, and hands the sidebar a
// fully serializable nav model — labels resolved here on the server so the
// client bundle never ships the dictionaries.
export default async function StoreOsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
      "id, name, slug, owner_id, plan, trial_ends_at, logo_url, business_types(slug)",
    )
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  const s = store as unknown as {
    id: string;
    name: string;
    slug: string | null;
    owner_id: string;
    plan: string | null;
    trial_ends_at: string | null;
    logo_url: string | null;
    business_types: { slug: string } | null;
  };
  // Effective plan mirrors getStorePlan: an active 14-day trial counts as Pro,
  // so the sidebar never shows a lock on a module the page will actually open.
  const trialEnds = s.trial_ends_at ? new Date(s.trial_ends_at) : null;
  const onTrial = trialEnds != null && trialEnds > new Date();
  const trialDaysLeft = onTrial
    ? Math.max(
        1,
        Math.ceil((trialEnds!.getTime() - requestNow()) / 86_400_000),
      )
    : 0;
  const effectivePlan = resolvePlan(s.plan, s.trial_ends_at);
  const category = (s.business_types?.slug as CategoryKey) ?? "retail";
  const sector = getSector(category);

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

  // Same label mapping as the OS home — every string is an existing dict key.
  const moduleLabel: Record<OsModuleKey, string> = {
    orders: dict.merchant.ordersLink,
    bookings: dict.merchant.bookingsLink,
    resources: dict.resources.link,
    memberships: dict.memberships.link,
    classes: dict.classes.link,
    portfolio: dict.portfolio.link,
    courses: dict.courses.link,
    tools: dict.hub.toolsTitle,
    requests: dict.os.requests.link,
    leads: dict.os.leads.link,
    units: dict.os.units.link,
    stays: dict.os.stays.link,
    tickets: dict.os.tickets.link,
    members: dict.os.members.link,
    items: dict.store[sector.flow.itemsKey],
    // The roster module is keyed `doctors` in the registry (so is its table and
    // its route) but a salon does not have doctors. The sector registry decides
    // the word; the key stays where the data is.
    doctors: dict.os.team[sectorTeamMeta(category).labelKey],
    customers: dict.os.nouns[sector.customersNoun],
    campaigns: dict.os.campaigns.link,
    staff: dict.merchant.staffLink,
    hr: dict.os.hr.title,
    automations: dict.os.automations.link,
    tasks: dict.os.tasks.link,
    inventory: dict.os.inventory.link,
    pos: dict.os.pos.link,
    suppliers: dict.os.suppliers.link,
    kitchen: dict.os.kitchen.link,
    reports: dict.merchant.analytics.link,
    accounting: dict.merchant.accounting.link,
    coupons: dict.merchant.coupons.link,
    subscription: dict.merchant.subscriptionLink,
    branches: dict.os.branches.link,
    verifications: dict.verifications.link,
    modules: dict.os.modules.heading,
    settings: dict.merchant.settingsLink,
    edit: dict.merchant.edit,
  };

  const base = `/${lang}/merchant/${storeId}`;
  const toItem = (key: OsModuleKey) => {
    const meta = OS_MODULE_META[key];
    return {
      key,
      label: moduleLabel[key],
      href: `${base}/${meta.path}`,
      locked: !!meta.minPlan && !hasPlan(effectivePlan, meta.minPlan),
    };
  };

  const nav: SidebarNav = {
    home: { key: "home", label: dict.dashboard.panel, href: base, exact: true },
    groups: OS_GROUPS.map((group) => ({
      key: group,
      label: dict.os.groups[group],
      items: sector.modules[group]
        .filter((key) => !PINNED.includes(key))
        .filter(canSee)
        .map(toItem),
    })).filter((group) => group.items.length > 0),
    pinned: PINNED.filter(canSee).map(toItem),
    backLabel: dict.merchant.products.back,
    supportLabel: dict.common.supportWhatsapp,
    viewStoreLabel: dict.os.viewPublic,
    proBadge: dict.os.pro.badge,
    freeBadge: dict.merchant.subscription.free,
    trialBadge: dict.os.pro.trialBadge.replace("{days}", String(trialDaysLeft)),
  };


  // ---- Phone tab bar ----------------------------------------------------
  // Derived from the sector's own module list, not a hardcoded map per
  // business type: a restaurant leads with الطلبات and a clinic with المواعيد
  // because sectors.ts already says which module comes first for each. A tab
  // the staff member cannot open is never rendered — canSee is the same gate
  // the sidebar uses.
  const sectorModules = new Set(OS_GROUPS.flatMap((g) => sector.modules[g]));
  const firstVisible = (candidates: OsModuleKey[]) =>
    candidates.find((k) => sectorModules.has(k) && canSee(k));

  // Order matters: the first match wins, so the most operational module for
  // that sector leads. "stays" and "tickets" are here because a hotel and an
  // events organiser have no orders or bookings table driving their day —
  // leaving them out gave those two sectors no operations tab at all, which
  // the per-sector resolution check caught.
  const opsKey = firstVisible([
    "orders",
    "bookings",
    "stays",
    "tickets",
    "requests",
    "leads",
  ]);
  const catalogKey = firstVisible([
    "items",
    "units",
    "resources",
    "classes",
    "courses",
  ]);
  const reportKey = firstVisible(["reports", "accounting"]);

  // Only the operations tab carries a badge, and only from a real count of
  // orders actually awaiting the merchant. A number they cannot clear would
  // be worse than none.
  let opsBadge = 0;
  if (opsKey === "orders") {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "pending");
    opsBadge = count ?? 0;
  }

  const tabs: MerchantTab[] = [
    { key: "home", label: dict.dashboard.panel, href: base },
    ...(opsKey
      ? [
          {
            key: opsKey,
            label: moduleLabel[opsKey],
            href: `${base}/${OS_MODULE_META[opsKey].path}`,
            badge: opsBadge,
          },
        ]
      : []),
    ...(catalogKey
      ? [
          {
            key: catalogKey,
            label: moduleLabel[catalogKey],
            href: `${base}/${OS_MODULE_META[catalogKey].path}`,
          },
        ]
      : []),
    ...(reportKey
      ? [
          {
            key: reportKey,
            label: moduleLabel[reportKey],
            href: `${base}/${OS_MODULE_META[reportKey].path}`,
          },
        ]
      : []),
    { key: "more", label: dict.os.groups.store },
  ];
  return (
    <div className="flex flex-col lg:flex-row">
      <MerchantSidebar
        lang={lang}
        storeId={storeId}
        storeName={s.name}
        logoUrl={s.logo_url}
        plan={planRank(effectivePlan) >= planRank("pro") ? "pro" : "free"}
        trialDaysLeft={trialDaysLeft}
        slug={s.slug}
        category={category}
        nav={nav}
        tabs={tabs}
      />
      {/* Clear the fixed phone tab bar (56px + safe area) so the last row of
          any screen is never trapped under it. */}
      <div className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>
    </div>
  );
}
