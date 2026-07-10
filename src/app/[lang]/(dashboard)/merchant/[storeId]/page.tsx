import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Package } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import type { CategoryKey } from "@/lib/catalog";
import { categoryModule } from "@/lib/modules";
import { SITE_URL } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { StoreShareCard } from "@/components/store-share-card";
import { ProductForm } from "@/components/product-form";
import { ProductRowActions } from "@/components/product-row-actions";
import {
  StoreChecklist,
  type ChecklistState,
} from "@/components/store-checklist";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProductRow = {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
  image_url: string | null;
};

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

export default async function ManageStorePage({
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
    .select("id, name, owner_id, short_code, logo_url, cover_url, description, opening_hours, whatsapp, business_types(slug)")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);
  const category =
    ((store as unknown as { business_types: { slug: string } | null })
      .business_types?.slug as CategoryKey) ?? "retail";
  const mod = categoryModule[category];
  const itemsLabel = dict.store[mod.itemsKey];

  // Owner gets everything; a staff member only their granted permissions.
  const isOwner =
    (store as unknown as { owner_id: string }).owner_id === user.id;
  let canProducts = true;
  let canOrders = true;
  let canBookings = true;
  if (!isOwner) {
    const { data: staffRow } = await supabase
      .from("store_staff")
      .select("permissions")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .maybeSingle();
    const perms =
      (staffRow?.permissions as Record<string, boolean> | null) ?? {};
    canProducts = perms.products ?? false;
    canOrders = perms.orders ?? false;
    canBookings = perms.bookings ?? false;
    // This page is the items view; send permitted-but-not-here staff onward.
    if (!canProducts) {
      if (canOrders) redirect(`/${lang}/merchant/${storeId}/orders`);
      if (canBookings) redirect(`/${lang}/merchant/${storeId}/bookings`);
      redirect(`/${lang}/merchant`);
    }
  }

  const { data } = await supabase
    .from("products")
    .select("id, name, price, is_available, image_url")
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const products = (data ?? []) as ProductRow[];

  // Live pulse for the top of the dashboard (cheap head-count queries).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [pendingOrdersRes, todayOrdersRes, pendingBookingsRes] =
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
    ]);
  const kpis = [
    {
      label: dict.merchant.kpi.pendingOrders,
      value: pendingOrdersRes.count ?? 0,
      href: `/${lang}/merchant/${storeId}/orders`,
      highlight: (pendingOrdersRes.count ?? 0) > 0,
    },
    {
      label: dict.merchant.kpi.todayOrders,
      value: todayOrdersRes.count ?? 0,
      href: `/${lang}/merchant/${storeId}/orders`,
      highlight: false,
    },
    {
      label: dict.merchant.kpi.pendingBookings,
      value: pendingBookingsRes.count ?? 0,
      href: `/${lang}/merchant/${storeId}/bookings`,
      highlight: (pendingBookingsRes.count ?? 0) > 0,
    },
  ];

  // Store-completion checklist (owner onboarding nudge).
  const s = store as unknown as {
    logo_url: string | null;
    cover_url: string | null;
    description: string | null;
    opening_hours: string | null;
    whatsapp: string | null;
  };
  const checklist: ChecklistState = {
    logo: !!s.logo_url,
    cover: !!s.cover_url,
    description: !!s.description?.trim(),
    hours: !!s.opening_hours?.trim(),
    whatsapp: !!s.whatsapp?.trim(),
    products: products.length >= 3,
  };
  const checklistComplete = Object.values(checklist).every(Boolean);

  return (
    <div className="py-10">
      <Container className="max-w-3xl">
        <Link
          href={`/${lang}/merchant`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.merchant.products.back}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {(store as { name: string }).name}
        </h1>

        {/* Live pulse — actionable stats so the merchant sees what needs attention. */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {kpis.map((k) => (
            <Link
              key={k.label}
              href={k.href}
              className={`rounded-2xl border p-4 transition-colors ${
                k.highlight
                  ? "border-primary/40 bg-primary-soft"
                  : "border-border bg-surface hover:bg-surface-muted"
              }`}
            >
              <div
                className={`text-2xl font-extrabold ${k.highlight ? "text-primary" : ""}`}
              >
                {k.value}
              </div>
              <div className="mt-1 text-xs font-semibold text-muted-foreground">
                {k.label}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5">
          <StoreShareCard
            code={(store as unknown as { short_code: string }).short_code}
            baseUrl={SITE_URL}
            dict={dict}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-foreground px-3.5 py-1.5 text-sm font-semibold text-background">
              {itemsLabel}
            </span>
            {mod.kind === "commerce"
              ? canOrders && (
                  <Link
                    href={`/${lang}/merchant/${storeId}/orders`}
                    className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
                  >
                    {dict.merchant.ordersLink}
                  </Link>
                )
              : canBookings && (
                  <Link
                    href={`/${lang}/merchant/${storeId}/bookings`}
                    className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
                  >
                    {dict.merchant.bookingsLink}
                  </Link>
                )}
            {category === "healthcare" && (
              <Link
                href={`/${lang}/merchant/${storeId}/doctors`}
                className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
              >
                {dict.merchant.doctorsLink}
              </Link>
            )}
            {canOrders && (
              <Link
                href={`/${lang}/merchant/${storeId}/customers`}
                className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
              >
                {dict.merchant.customersLink}
              </Link>
            )}
            {canOrders && (
              <Link
                href={`/${lang}/merchant/${storeId}/reports`}
                className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
              >
                {dict.merchant.analytics.link}
              </Link>
            )}
            {isOwner && (
              <Link
                href={`/${lang}/merchant/${storeId}/staff`}
                className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
              >
                {dict.merchant.staffLink}
              </Link>
            )}
            {isOwner && (
              <Link
                href={`/${lang}/merchant/${storeId}/subscription`}
                className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
              >
                {dict.merchant.subscriptionLink}
              </Link>
            )}
            {isOwner && (
              <Link
                href={`/${lang}/merchant/${storeId}/coupons`}
                className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
              >
                {dict.merchant.coupons.link}
              </Link>
            )}
            {isOwner && (
              <Link
                href={`/${lang}/merchant/${storeId}/settings`}
                className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
              >
                {dict.merchant.settingsLink}
              </Link>
            )}
          </div>
          {isOwner && (
            <Link
              href={`/${lang}/merchant/${storeId}/edit`}
              className="rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              {dict.merchant.edit}
            </Link>
          )}
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

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="mb-4 text-lg font-bold">{itemsLabel}</h2>
            {products.length ? (
              <div className="space-y-3">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 rounded-xl border border-border bg-surface p-3 ${p.is_available ? "" : "opacity-60"}`}
                  >
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
                        <Package className="h-5 w-5" />
                      </span>
                    )}
                    <span className="flex-1 font-semibold">{p.name}</span>
                    <span className="font-bold text-primary">
                      {formatPrice(p.price)}
                    </span>
                    <Link
                      href={`/${lang}/merchant/${storeId}/products/${p.id}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                    >
                      {dict.merchant.products.editAction}
                    </Link>
                    <ProductRowActions
                      productId={p.id}
                      isAvailable={p.is_available}
                      showLabel={dict.merchant.products.show}
                      hideLabel={dict.merchant.products.hide}
                      deleteLabel={dict.merchant.products.delete}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
                {dict.merchant.products.empty}
              </div>
            )}
          </div>

          <ProductForm
            storeId={storeId}
            lang={lang}
            category={category}
            dict={dict}
            addKey={mod.addKey}
            simplified={mod.simplifiedItem}
          />
        </div>
      </Container>
    </div>
  );
}
