import { notFound, redirect } from "next/navigation";
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
    .select("id, name, slug, owner_id, plan, logo_url, business_types(slug)")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  const s = store as unknown as {
    id: string;
    name: string;
    slug: string | null;
    owner_id: string;
    plan: "free" | "pro" | null;
    logo_url: string | null;
    business_types: { slug: string } | null;
  };
  const storeIsPro = s.plan === "pro";
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
    requests: dict.os.requests.link,
    items: dict.store[sector.flow.itemsKey],
    doctors: dict.merchant.doctorsLink,
    customers: dict.os.nouns[sector.customersNoun],
    campaigns: dict.os.campaigns.link,
    staff: dict.merchant.staffLink,
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
      locked: !!meta.pro && !storeIsPro,
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
    viewStoreLabel: dict.os.viewPublic,
    proBadge: dict.os.pro.badge,
    freeBadge: dict.merchant.subscription.free,
  };

  return (
    <div className="flex flex-col lg:flex-row">
      <MerchantSidebar
        lang={lang}
        storeId={storeId}
        storeName={s.name}
        logoUrl={s.logo_url}
        plan={storeIsPro ? "pro" : "free"}
        slug={s.slug}
        nav={nav}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
