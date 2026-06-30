"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export type Variant = {
  id: string;
  label: string;
  price: number | null;
  stock: number | null;
  is_available: boolean;
};
export type AddOn = { id: string; name: string; price: number };

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

export function ProductOrder({
  lang,
  dict,
  storeId,
  productId,
  productName,
  basePrice,
  stock,
  variants,
  addons,
}: {
  lang: Locale;
  dict: Dictionary;
  storeId: string;
  productId: string;
  productName: string;
  basePrice: number;
  stock: number | null;
  variants: Variant[];
  addons: AddOn[];
}) {
  const router = useRouter();
  const [variantId, setVariantId] = useState<string | null>(
    variants[0]?.id ?? null,
  );
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [checkingOut, setCheckingOut] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    "delivery",
  );

  const variant = variants.find((v) => v.id === variantId) ?? null;
  const variantStock = variant ? variant.stock : stock;
  const soldOut =
    (variant ? !variant.is_available : false) ||
    (variantStock != null && variantStock <= 0);
  const maxQty = variantStock ?? Infinity;

  const unitBase = variant?.price ?? basePrice;
  const addonsSum = addons
    .filter((a) => selectedAddons.includes(a.id))
    .reduce((s, a) => s + a.price, 0);
  const unitPrice = unitBase + addonsSum;
  const total = unitPrice * qty;

  function toggleAddon(id: string) {
    setSelectedAddons((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  async function confirmOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPlacing(true);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/${lang}/login`);
      return;
    }
    const chosenAddons = addons.filter((a) => selectedAddons.includes(a.id));
    const itemName =
      productName +
      (variant ? ` - ${variant.label}` : "") +
      (chosenAddons.length
        ? ` (+ ${chosenAddons.map((a) => a.name).join(", ")})`
        : "");

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        store_id: storeId,
        customer_id: user.id,
        customer_name:
          (user.user_metadata?.full_name as string | undefined) ?? null,
        subtotal: total,
        total,
        fulfillment,
        address: String(form.get("address")) || null,
        phone: String(form.get("phone")) || null,
        customer_note: String(form.get("note")) || null,
      })
      .select("id")
      .single();
    if (error || !order) {
      setPlacing(false);
      return;
    }
    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      name: itemName,
      unit_price: unitPrice,
      quantity: qty,
    });
    router.push(`/${lang}/orders`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Variants */}
      {variants.length > 0 && (
        <div>
          <span className="text-sm font-semibold">{dict.product.selectVariant}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((v) => {
              const vOut = !v.is_available || (v.stock != null && v.stock <= 0);
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={vOut}
                  onClick={() => setVariantId(v.id)}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    variantId === v.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {v.label}
                  {v.price != null && (
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      {formatPrice(v.price)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add-ons */}
      {addons.length > 0 && (
        <div>
          <span className="text-sm font-semibold">{dict.product.addons}</span>
          <div className="mt-2 space-y-2">
            {addons.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-4 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={selectedAddons.includes(a.id)}
                    onChange={() => toggleAddon(a.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  {a.name}
                </span>
                <span className="font-bold text-primary">
                  + {formatPrice(a.price)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Quantity + total */}
      {!checkingOut && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{dict.product.quantity}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted"
                aria-label="-"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-bold">{qty}</span>
              <button
                type="button"
                disabled={qty >= maxQty}
                onClick={() => setQty((q) => q + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted disabled:opacity-40"
                aria-label="+"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-lg font-extrabold">
              {dict.product.total}: {formatPrice(total)}
            </span>
            <button
              type="button"
              disabled={soldOut}
              onClick={() => setCheckingOut(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4" />
              {soldOut ? dict.product.outOfStock : dict.product.buyNow}
            </button>
          </div>
        </>
      )}

      {/* Checkout */}
      {checkingOut && (
        <form
          onSubmit={confirmOrder}
          className="space-y-4 border-t border-border pt-4"
        >
          <p className="text-lg font-extrabold">
            {dict.product.total}: {formatPrice(total)}
          </p>
          <div>
            <span className="text-sm font-semibold">{dict.store.fulfillment}</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["delivery", "pickup"] as const).map((opt) => (
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
          {fulfillment === "delivery" && (
            <div>
              <label className="text-sm font-semibold" htmlFor="address">
                {dict.store.address}
              </label>
              <input id="address" name="address" type="text" required placeholder={dict.store.addressPlaceholder} className={fieldClass} />
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
              disabled={placing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {placing ? dict.store.placing : dict.store.confirmOrder}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
