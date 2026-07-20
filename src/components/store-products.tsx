"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, MessageCircle, Check, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { categoryStyles, type CategoryKey } from "@/lib/catalog";
import { attributeSummary } from "@/lib/attributes";
import { effectivePrice, compareAtPrice, isFlashActive } from "@/lib/pricing";
import { waLink, buildOrderMessage } from "@/lib/whatsapp";
import { formatLbp } from "@/lib/currency";
import { localized } from "@/lib/i18n-field";
import { groupBySection, type SectionInfo } from "@/lib/sections";
import { categoryIcons } from "@/components/category-icon";

type Product = {
  id: string;
  name: string;
  nameEn?: string | null;
  price: number;
  discountPrice?: number | null;
  imageUrl?: string | null;
  attributes?: Record<string, string> | null;
  flashPrice?: number | null;
  flashStart?: string | null;
  flashEnd?: string | null;
  stock?: number | null;
  sectionId?: string | null;
};

function PriceTag({ p }: { p: Product }) {
  const eff = effectivePrice(p);
  const compare = compareAtPrice(p);
  const flash = isFlashActive(p);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`font-bold ${flash ? "text-amber-600" : "text-primary"}`}>
        {formatPrice(eff)}
      </span>
      {compare != null && (
        <span className="text-xs font-normal text-muted-foreground line-through">
          {formatPrice(compare)}
        </span>
      )}
      {flash && <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
    </span>
  );
}

const GRID_CATEGORIES = new Set<CategoryKey>([
  "retail",
  "realEstate",
  "automotive",
]);

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

export function StoreProducts({
  storeId,
  lang,
  dict,
  category,
  isBooking,
  products,
  loggedIn = true,
  defaultAddress = "",
  savedAddresses = [],
  acceptsDelivery = true,
  acceptsPickup = true,
  minOrder = null,
  paymentNote = null,
  prepTime = null,
  whatsapp = null,
  storeName = "",
  lbpRate = 0,
  loyaltyPoints = 0,
  loyaltyPointsPerUnit = 0,
  branches = [],
  sections = [],
  layout = null,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  category: CategoryKey;
  isBooking: boolean;
  products: Product[];
  layout?: "grid" | "menu" | "showcase" | null;
  sections?: SectionInfo[];
  loggedIn?: boolean;
  defaultAddress?: string;
  savedAddresses?: { label: string; value: string }[];
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
  minOrder?: number | null;
  paymentNote?: string | null;
  prepTime?: string | null;
  whatsapp?: string | null;
  storeName?: string;
  lbpRate?: number;
  loyaltyPoints?: number;
  loyaltyPointsPerUnit?: number;
  branches?: {
    id: string;
    name: string | null;
    area: string | null;
    address: string | null;
  }[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const cartKey = `matjar-cart-${storeId}`;

  // Persist the cart per store so a refresh / accidental navigation doesn't
  // wipe it (a common drop-off point). Loaded on mount to avoid SSR mismatch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(cartKey);
      if (saved) setCart(JSON.parse(saved));
    } catch {
      /* ignore corrupt storage */
    }
  }, [cartKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    try {
      if (Object.keys(cart).length) {
        localStorage.setItem(cartKey, JSON.stringify(cart));
      } else {
        localStorage.removeItem(cartKey);
      }
    } catch {
      /* ignore */
    }
  }, [cart, cartKey]);

  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const fulfillmentOptions = (["delivery", "pickup"] as const).filter((o) =>
    o === "delivery" ? acceptsDelivery : acceptsPickup,
  );
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    acceptsDelivery ? "delivery" : "pickup",
  );
  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [addressValue, setAddressValue] = useState(defaultAddress);
  // Loyalty redemption: opt-in per store (0107). Only offered when the customer
  // actually holds points here and the store set a conversion rate.
  const canRedeem = loyaltyPoints > 0 && loyaltyPointsPerUnit > 0;
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  // Multi-branch stores: the customer picks a branch before ordering.
  // Defaults to the first entry — the primary (server orders by is_primary desc).
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? "");

  const Icon = categoryIcons[category];
  const style = categoryStyles[category];
  // Layout: the merchant's chosen template overrides the sector default. "menu"
  // is the compact row list; "grid"/"showcase" are both image-top card grids
  // (showcase = fewer, larger cards).
  const effectiveLayout =
    layout ?? (GRID_CATEGORIES.has(category) ? "grid" : "menu");
  const isRow = effectiveLayout === "menu";
  const isShowcase = effectiveLayout === "showcase";
  const isGrid = !isRow; // image-top card (grid or showcase) vs. row list
  const addLabel = isBooking ? dict.store.book : dict.store.order;

  function setQty(id: string, qty: number) {
    // Never let the cart exceed tracked stock — overselling is also caught
    // server-side, but capping here keeps the UI honest.
    const p = products.find((x) => x.id === id);
    const max = p?.stock != null ? p.stock : Infinity;
    const clamped = Math.min(qty, max);
    setCart((c) => {
      const next = { ...c };
      if (clamped <= 0) delete next[id];
      else next[id] = clamped;
      return next;
    });
  }

  const items = products.filter((p) => (cart[p.id] ?? 0) > 0);
  const total = items.reduce(
    (sum, p) => sum + effectivePrice(p) * cart[p.id],
    0,
  );
  const belowMin = minOrder != null && total < minOrder;
  // Points discount mirrors the server: currency value of the whole balance,
  // rounded to cents, then capped at the order total after the coupon. The RPC
  // recomputes + re-caps this authoritatively — this is display only.
  const afterCoupon = Math.max(0, total - couponDiscount);
  const pointsDiscount =
    canRedeem && redeemLoyalty
      ? Math.min(
          Math.round((loyaltyPoints / loyaltyPointsPerUnit) * 100) / 100,
          afterCoupon,
        )
      : 0;
  const pointsUsed = Math.round(pointsDiscount * loyaltyPointsPerUnit);
  const finalTotal = Math.max(0, total - couponDiscount - pointsDiscount);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    // Guests can't call validate_coupon (locked to authenticated to stop code
    // enumeration). Their code is applied server-side inside place_guest_order;
    // here we just accept it and note it'll apply at checkout.
    if (!loggedIn) {
      setAppliedCode(couponInput.trim().toUpperCase());
      setCouponDiscount(0);
      setCouponMsg(dict.store.couponGuestNote);
      return;
    }
    setCouponBusy(true);
    setCouponMsg(null);
    const { data, error } = await createClient().rpc("validate_coupon", {
      p_store_id: storeId,
      p_code: couponInput.trim().toUpperCase(),
      p_subtotal: total,
    });
    setCouponBusy(false);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { valid: boolean; discount: number; reason: string }
      | undefined;
    if (error || !row || !row.valid) {
      const reasons: Record<string, string> = {
        invalid: dict.store.couponInvalid,
        expired: dict.store.couponExpired,
        used_up: dict.store.couponUsedUp,
        min_order: dict.store.couponMinOrder,
      };
      setCouponMsg(reasons[row?.reason ?? "invalid"] ?? dict.store.couponInvalid);
      setAppliedCode(null);
      setCouponDiscount(0);
      return;
    }
    setAppliedCode(couponInput.trim().toUpperCase());
    setCouponDiscount(Number(row.discount) || 0);
    setCouponMsg(null);
  }

  // Abandoned-cart capture: fire-and-forget a "checkout intent" as the customer
  // enters a phone, so the merchant's order_abandoned automation can win them
  // back if they never place the order. It is NEVER awaited and can NEVER throw
  // — wrapped so it cannot touch the checkout / order-submit path in any way.
  function captureCheckoutIntent(phone: string, name: string) {
    const trimmed = phone.trim();
    if (trimmed.length < 4 || items.length === 0) return;
    try {
      void createClient()
        .rpc("record_checkout_intent", {
          p_store_id: storeId,
          p_phone: trimmed,
          p_name: name.trim() || null,
          p_items: items.map((p) => ({
            product_id: p.id,
            name: p.name,
            quantity: cart[p.id],
          })),
        })
        .then(
          () => {},
          () => {},
        );
    } catch {
      /* never affect checkout */
    }
  }

  const waUrl =
    whatsapp && items.length
      ? waLink(
          whatsapp,
          buildOrderMessage({
            greeting: dict.store.waGreeting,
            storeName,
            lines: items.map((p) => ({
              name: p.name,
              qty: cart[p.id],
              lineTotal: formatPrice(effectivePrice(p) * cart[p.id]),
            })),
            totalLabel: dict.store.total,
            total: formatPrice(total),
            address: defaultAddress || null,
          }),
        )
      : null;

  async function confirmOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPlacing(true);
    setOrderError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Single-branch stores never ask — null lets the server pick the primary.
    const locationId = branches.length > 1 ? branchId : null;

    // Guest checkout: no account needed. A SECURITY DEFINER RPC validates the
    // store, recomputes prices server-side and records the order + items.
    if (!user) {
      const { data: guestOrderId, error: guestError } = await supabase.rpc(
        "place_guest_order",
        {
          p_store_id: storeId,
          p_customer_name: String(form.get("name") ?? ""),
          p_phone: String(form.get("phone") ?? ""),
          p_address:
            fulfillment === "delivery" ? String(form.get("address") ?? "") : "",
          p_fulfillment: fulfillment,
          p_note: String(form.get("note") ?? ""),
          p_coupon: appliedCode,
          p_items: items.map((p) => ({
            product_id: p.id,
            quantity: cart[p.id],
          })),
          p_location_id: locationId,
        },
      );
      setPlacing(false);
      if (guestError || !guestOrderId) {
        const msg = guestError?.message ?? "";
        setOrderError(
          msg.includes("insufficient_stock")
            ? dict.store.outOfStock
            : msg.includes("rate_limited")
              ? dict.store.tooManyOrders
              : dict.auth.errorGeneric,
        );
        router.refresh();
        return;
      }
      setCheckingOut(false);
      setPlacedOrderId(guestOrderId as string);
      setOrderPlaced(true);
      setCart({});
      return;
    }

    // Server-side pricing: the RPC recomputes every price from the live
    // catalog (never trusting the client), applies the coupon, and the stock
    // guard fires inside the same transaction.
    const { error } = await supabase.rpc("place_customer_order", {
      p_store_id: storeId,
      p_phone: String(form.get("phone") ?? ""),
      p_address: String(form.get("address") ?? ""),
      p_fulfillment: fulfillment,
      p_note: String(form.get("note") ?? ""),
      p_coupon: appliedCode,
      p_items: items.map((p) => ({
        product_id: p.id,
        quantity: cart[p.id],
      })),
      p_location_id: locationId,
      // Send the full balance; the server caps it to the order total and consumes
      // only the points that discount is worth. 0 (or opt-out) redeems nothing.
      p_redeem_points: canRedeem && redeemLoyalty ? loyaltyPoints : 0,
    });
    if (error) {
      const outOfStock = error.message?.includes("insufficient_stock");
      setOrderError(outOfStock ? dict.store.outOfStock : dict.auth.errorGeneric);
      setPlacing(false);
      router.refresh();
      return;
    }
    // Order recorded. Instead of a silent redirect, show a confirmation that
    // lets the customer ping the merchant on WhatsApp — so a merchant who
    // doesn't watch the dashboard still learns about the order immediately.
    setPlacing(false);
    setCheckingOut(false);
    setOrderPlaced(true);
    setCart({}); // clears persisted cart via the storage effect
    router.refresh();
  }

  function Stepper({ id, qty }: { id: string; qty: number }) {
    const p = products.find((x) => x.id === id);
    const atMax = p?.stock != null && qty >= p.stock;
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setQty(id, qty - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted"
          aria-label="-"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-5 text-center font-bold">{qty}</span>
        <button
          onClick={() => setQty(id, qty + 1)}
          disabled={atMax}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="+"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  function Card({ p }: { p: Product }) {
    return p.imageUrl ? (
      <Image
        src={p.imageUrl}
        alt={localized(p.name, p.nameEn, lang)}
        width={isGrid ? 400 : 64}
        height={isGrid ? (isShowcase ? 300 : 200) : 64}
        className={
          isGrid
            ? `${isShowcase ? "h-56" : "h-40"} w-full object-cover`
            : "h-16 w-16 shrink-0 rounded-xl object-cover"
        }
        sizes={isGrid ? "(max-width: 640px) 100vw, 50vw" : "64px"}
      />
    ) : (
      <div
        className={`flex items-center justify-center bg-gradient-to-br ${style.cover} ${isGrid ? `${isShowcase ? "h-56" : "h-40"} w-full` : "h-16 w-16 shrink-0 rounded-xl"}`}
      >
        <Icon className={isGrid ? "h-10 w-10 text-black/20" : "h-7 w-7 text-black/20"} />
      </div>
    );
  }

  // Render one arbitrary subset of products (a section's items, or the whole
  // flat catalog). Keeps the per-category grid/list styling; grouping only
  // decides which products land in which call.
  function renderList(list: Product[]) {
    return isGrid ? (
      <div
        className={
          isShowcase
            ? "grid grid-cols-1 gap-5 sm:grid-cols-2"
            : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        }
      >
        {list.map((p) => {
          const qty = cart[p.id] ?? 0;
          return (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
                <Card p={p} />
                <div className="flex flex-1 flex-col p-4">
                  <Link
                    href={`/${lang}/product/${p.id}`}
                    className="font-bold leading-tight transition-colors hover:text-primary"
                  >
                    {localized(p.name, p.nameEn, lang)}
                  </Link>
                  {attributeSummary(category, p.attributes, lang) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {attributeSummary(category, p.attributes, lang)}
                    </p>
                  )}
                  <p className="mt-1">
                    <PriceTag p={p} />
                  </p>
                  {p.stock != null && p.stock > 0 && p.stock <= 5 && (
                    <p className="mt-1 text-xs font-bold text-amber-600">
                      {dict.store.onlyLeft.replace("{n}", String(p.stock))}
                    </p>
                  )}
                  <div className="mt-3 flex justify-end">
                    {p.stock != null && p.stock <= 0 ? (
                      <span className="w-full rounded-lg bg-surface-muted px-3.5 py-2 text-center text-sm font-bold text-muted-foreground">
                        {dict.store.soldOut}
                      </span>
                    ) : qty > 0 ? (
                      <Stepper id={p.id} qty={qty} />
                    ) : (
                      <button
                        onClick={() => setQty(p.id, 1)}
                        className="w-full rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                      >
                        {addLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {list.map((p) => {
            const qty = cart[p.id] ?? 0;
            return (
              <div key={p.id} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
                <Card p={p} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${lang}/product/${p.id}`}
                    className="block truncate font-bold transition-colors hover:text-primary"
                  >
                    {localized(p.name, p.nameEn, lang)}
                  </Link>
                  {attributeSummary(category, p.attributes, lang) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {attributeSummary(category, p.attributes, lang)}
                    </p>
                  )}
                  <p className="mt-0.5 text-sm">
                    <PriceTag p={p} />
                    {p.stock != null && p.stock > 0 && p.stock <= 5 && (
                      <span className="ms-2 text-xs font-bold text-amber-600">
                        {dict.store.onlyLeft.replace("{n}", String(p.stock))}
                      </span>
                    )}
                  </p>
                </div>
                {p.stock != null && p.stock <= 0 ? (
                  <span className="shrink-0 rounded-lg bg-surface-muted px-3.5 py-2 text-sm font-bold text-muted-foreground">
                    {dict.store.soldOut}
                  </span>
                ) : qty > 0 ? (
                  <Stepper id={p.id} qty={qty} />
                ) : (
                  <button
                    onClick={() => setQty(p.id, 1)}
                    className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                  >
                    {addLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      );
  }

  // Group for display when the store defined sections; otherwise one flat list
  // (no headers, no regression). Cart/total logic still uses the full `products`.
  const groups = groupBySection(products, sections);

  return (
    <div>
      {sections.length > 0 ? (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.section?.id ?? "__other"}>
              <h3 className="mb-4 text-lg font-bold">
                {g.section
                  ? localized(g.section.name, g.section.nameEn, lang)
                  : dict.store.otherSection}
              </h3>
              {renderList(g.items)}
            </section>
          ))}
        </div>
      ) : (
        renderList(products)
      )}

      {orderPlaced ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-lg font-extrabold">
            {dict.store.orderPlacedTitle}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {dict.store.orderPlacedNote}
          </p>
          <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                {dict.store.notifyMerchantWa}
              </a>
            )}
            {loggedIn ? (
              <Link
                href={`/${lang}/orders`}
                className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
              >
                {dict.store.viewMyOrders}
              </Link>
            ) : (
              placedOrderId && (
                <Link
                  href={`/${lang}/track/${placedOrderId}`}
                  className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
                >
                  {dict.os.track.trackLink}
                </Link>
              )
            )}
          </div>
          {!loggedIn && placedOrderId && (
            <p className="mt-3 text-xs font-semibold text-muted-foreground">
              {dict.os.track.saveLink}
            </p>
          )}
        </div>
      ) : items.length > 0 &&
        (checkingOut ? (
          <form
            onSubmit={confirmOrder}
            className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm"
          >
            {/* Coupon */}
            <div>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={dict.store.couponCode}
                  className={`${fieldClass} mt-0 flex-1 uppercase`}
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponBusy || !couponInput.trim()}
                  className="shrink-0 rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  {dict.store.couponApply}
                </button>
              </div>
              {couponMsg && (
                <p className="mt-1 text-sm font-medium text-red-600">{couponMsg}</p>
              )}
              {appliedCode && (
                <p className="mt-1 text-sm font-semibold text-primary">
                  {appliedCode} ✓
                </p>
              )}
            </div>

            {/* Loyalty points redemption (store opt-in + customer has points) */}
            {canRedeem && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-muted/50 p-3">
                <input
                  type="checkbox"
                  checked={redeemLoyalty}
                  onChange={(e) => setRedeemLoyalty(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-sm">
                  <span className="font-semibold">
                    {dict.store.loyaltyRedeemTitle}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {dict.store.loyaltyRedeemDesc.replace(
                      "{n}",
                      loyaltyPoints.toLocaleString("en-US"),
                    )}
                  </span>
                </span>
              </label>
            )}

            {/* Totals */}
            <div className="space-y-1 border-t border-border pt-3 text-sm">
              {(couponDiscount > 0 || pointsDiscount > 0) && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{dict.store.subtotal}</span>
                  <span>{formatPrice(total)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>{dict.store.discount}</span>
                  <span>−{formatPrice(couponDiscount)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>
                    {dict.store.loyaltyDiscount.replace(
                      "{n}",
                      pointsUsed.toLocaleString("en-US"),
                    )}
                  </span>
                  <span>−{formatPrice(pointsDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-extrabold">
                <span>{dict.store.total}</span>
                <span>{formatPrice(finalTotal)}</span>
              </div>
              {lbpRate > 0 && (
                <p className="text-end text-xs font-normal text-muted-foreground">
                  {formatLbp(finalTotal, lbpRate, lang)}
                </p>
              )}
            </div>

            <p className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              💵 {dict.store.codNote}
            </p>
            {fulfillmentOptions.length > 1 && (
              <div>
                <span className="text-sm font-semibold">{dict.store.fulfillment}</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {fulfillmentOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFulfillment(opt)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
                        fulfillment === opt
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {opt === "delivery" ? dict.store.delivery : dict.store.pickup}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {branches.length > 1 && (
              <div>
                <label className="text-sm font-semibold" htmlFor="branch">
                  {dict.store.chooseBranch}
                </label>
                <select
                  id="branch"
                  required
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className={fieldClass}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.area || b.address || "—"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(prepTime || paymentNote) && (
              <div className="space-y-1 rounded-xl bg-surface-muted/60 px-4 py-3 text-sm text-muted-foreground">
                {prepTime && (
                  <p>
                    <span className="font-semibold">{dict.store.prep}:</span> {prepTime}
                  </p>
                )}
                {paymentNote && (
                  <p>
                    <span className="font-semibold">{dict.store.payment}:</span> {paymentNote}
                  </p>
                )}
              </div>
            )}
            {belowMin && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">
                {dict.store.belowMin} ({formatPrice(minOrder!)})
              </p>
            )}
            {fulfillment === "delivery" && (
              <div>
                <label className="text-sm font-semibold" htmlFor="address">
                  {dict.store.address}
                </label>
                {savedAddresses.length > 1 && (
                  <select
                    aria-label={dict.account.address.useSaved}
                    className={fieldClass}
                    value={
                      savedAddresses.some((a) => a.value === addressValue)
                        ? addressValue
                        : ""
                    }
                    onChange={(e) => setAddressValue(e.target.value)}
                  >
                    <option value="">{dict.account.address.useSaved}</option>
                    {savedAddresses.map((a, i) => (
                      <option key={i} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  value={addressValue}
                  onChange={(e) => setAddressValue(e.target.value)}
                  placeholder={dict.store.addressPlaceholder}
                  className={fieldClass}
                />
              </div>
            )}
            {!loggedIn && (
              <div>
                <label className="text-sm font-semibold" htmlFor="name">
                  {dict.store.name}
                </label>
                <input id="name" name="name" type="text" required placeholder={dict.store.namePlaceholder} className={fieldClass} />
              </div>
            )}
            <div>
              <label className="text-sm font-semibold" htmlFor="phone">
                {dict.store.phone}
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                required
                placeholder="+961 …"
                className={fieldClass}
                onBlur={(e) => {
                  const form = e.currentTarget.form;
                  const name = form
                    ? String(new FormData(form).get("name") ?? "")
                    : "";
                  captureCheckoutIntent(e.currentTarget.value, name);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="note">
                {dict.store.note}
              </label>
              <textarea id="note" name="note" rows={2} placeholder={dict.store.notePlaceholder} className={fieldClass} />
            </div>
            {!loggedIn && (
              <p className="text-xs text-muted-foreground">
                {dict.store.guestHint}{" "}
                <Link
                  href={`/${lang}/login`}
                  className="font-semibold text-primary hover:underline"
                >
                  {dict.store.guestLogin}
                </Link>
              </p>
            )}
            {orderError && (
              <p className="text-sm font-medium text-red-600">{orderError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCheckingOut(false)}
                className="rounded-xl border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-surface-muted"
              >
                {dict.store.back}
              </button>
              <button
                type="submit"
                disabled={placing || belowMin}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                {placing ? dict.store.placing : dict.store.confirmOrder}
              </button>
            </div>
          </form>
        ) : (
          <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-lg">
            <div>
              <p className="text-sm text-muted-foreground">{dict.store.yourOrder}</p>
              <p className="text-lg font-extrabold">
                {dict.store.total}: {formatPrice(total)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">{dict.store.orderWhatsapp}</span>
                </a>
              )}
              <button
                onClick={() => setCheckingOut(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <ShoppingCart className="h-4 w-4" />
                {dict.store.checkout}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
