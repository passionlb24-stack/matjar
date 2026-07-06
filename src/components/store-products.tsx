"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, MessageCircle, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { categoryStyles, type CategoryKey } from "@/lib/catalog";
import { attributeSummary } from "@/lib/attributes";
import { waLink, buildOrderMessage } from "@/lib/whatsapp";
import { formatLbp } from "@/lib/currency";
import { categoryIcons } from "@/components/category-icon";

type Product = {
  id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  imageUrl?: string | null;
  attributes?: Record<string, string> | null;
};

function effectivePrice(p: Product) {
  return p.discountPrice != null ? p.discountPrice : p.price;
}

function PriceTag({ p }: { p: Product }) {
  if (p.discountPrice != null) {
    return (
      <span>
        <span className="font-bold text-primary">
          {formatPrice(p.discountPrice)}
        </span>{" "}
        <span className="text-xs font-normal text-muted-foreground line-through">
          {formatPrice(p.price)}
        </span>
      </span>
    );
  }
  return (
    <span className="font-bold text-primary">{formatPrice(p.price)}</span>
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
  defaultAddress = "",
  acceptsDelivery = true,
  acceptsPickup = true,
  minOrder = null,
  paymentNote = null,
  prepTime = null,
  whatsapp = null,
  storeName = "",
  lbpRate = 0,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  category: CategoryKey;
  isBooking: boolean;
  products: Product[];
  defaultAddress?: string;
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
  minOrder?: number | null;
  paymentNote?: string | null;
  prepTime?: string | null;
  whatsapp?: string | null;
  storeName?: string;
  lbpRate?: number;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
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

  const Icon = categoryIcons[category];
  const style = categoryStyles[category];
  const isGrid = GRID_CATEGORIES.has(category);
  const addLabel = isBooking ? dict.store.book : dict.store.order;

  function setQty(id: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  const items = products.filter((p) => (cart[p.id] ?? 0) > 0);
  const total = items.reduce(
    (sum, p) => sum + effectivePrice(p) * cart[p.id],
    0,
  );
  const belowMin = minOrder != null && total < minOrder;
  const finalTotal = Math.max(0, total - couponDiscount);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
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
    if (!user) {
      setPlacing(false);
      router.push(`/${lang}/login`);
      return;
    }
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        store_id: storeId,
        customer_id: user.id,
        customer_name:
          (user.user_metadata?.full_name as string | undefined) ?? null,
        subtotal: total,
        discount: couponDiscount,
        coupon_code: appliedCode,
        total: finalTotal,
        fulfillment,
        address: String(form.get("address")) || null,
        phone: String(form.get("phone")) || null,
        customer_note: String(form.get("note")) || null,
      })
      .select("id")
      .single();
    if (error || !order) {
      setOrderError(dict.auth.errorGeneric);
      setPlacing(false);
      return;
    }
    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((p) => ({
        order_id: order.id,
        product_id: p.id,
        name: p.name,
        unit_price: effectivePrice(p),
        quantity: cart[p.id],
      })),
    );
    if (itemsError) {
      // Roll back the empty order so the customer doesn't see a phantom order.
      await supabase.from("orders").delete().eq("id", order.id);
      // The stock-guard trigger raises 'insufficient_stock' when an item ran
      // out between page load and checkout — show a clear message, not a generic one.
      const outOfStock = itemsError.message?.includes("insufficient_stock");
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
    router.refresh();
  }

  function Stepper({ id, qty }: { id: string; qty: number }) {
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
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted"
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
        alt={p.name}
        width={isGrid ? 300 : 64}
        height={isGrid ? 200 : 64}
        className={isGrid ? "h-40 w-full object-cover" : "h-16 w-16 shrink-0 rounded-xl object-cover"}
        sizes={isGrid ? "(max-width: 640px) 50vw, 25vw" : "64px"}
      />
    ) : (
      <div
        className={`flex items-center justify-center bg-gradient-to-br ${style.cover} ${isGrid ? "h-40 w-full" : "h-16 w-16 shrink-0 rounded-xl"}`}
      >
        <Icon className={isGrid ? "h-10 w-10 text-black/20" : "h-7 w-7 text-black/20"} />
      </div>
    );
  }

  return (
    <div>
      {isGrid ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const qty = cart[p.id] ?? 0;
            return (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
                <Card p={p} />
                <div className="flex flex-1 flex-col p-4">
                  <Link
                    href={`/${lang}/product/${p.id}`}
                    className="font-bold leading-tight transition-colors hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  {attributeSummary(category, p.attributes, lang) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {attributeSummary(category, p.attributes, lang)}
                    </p>
                  )}
                  <p className="mt-1">
                    <PriceTag p={p} />
                  </p>
                  <div className="mt-3 flex justify-end">
                    {qty > 0 ? (
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
          {products.map((p) => {
            const qty = cart[p.id] ?? 0;
            return (
              <div key={p.id} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
                <Card p={p} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${lang}/product/${p.id}`}
                    className="block truncate font-bold transition-colors hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  {attributeSummary(category, p.attributes, lang) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {attributeSummary(category, p.attributes, lang)}
                    </p>
                  )}
                  <p className="mt-0.5 text-sm">
                    <PriceTag p={p} />
                  </p>
                </div>
                {qty > 0 ? (
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
            <Link
              href={`/${lang}/orders`}
              className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
            >
              {dict.store.viewMyOrders}
            </Link>
          </div>
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

            {/* Totals */}
            <div className="space-y-1 border-t border-border pt-3 text-sm">
              {couponDiscount > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{dict.store.subtotal}</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>{dict.store.discount}</span>
                    <span>−{formatPrice(couponDiscount)}</span>
                  </div>
                </>
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
                <input id="address" name="address" type="text" required defaultValue={defaultAddress} placeholder={dict.store.addressPlaceholder} className={fieldClass} />
              </div>
            )}
            <div>
              <label className="text-sm font-semibold" htmlFor="phone">
                {dict.store.phone}
              </label>
              <input id="phone" name="phone" type="tel" inputMode="tel" required placeholder="+961 …" className={fieldClass} />
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="note">
                {dict.store.note}
              </label>
              <textarea id="note" name="note" rows={2} placeholder={dict.store.notePlaceholder} className={fieldClass} />
            </div>
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
