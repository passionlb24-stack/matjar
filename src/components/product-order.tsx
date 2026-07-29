"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatLbp } from "@/lib/currency";

export type Variant = {
  id: string;
  label: string;
  price: number | null;
  stock: number | null;
  is_available: boolean;
  color: string | null;
  size: string | null;
};
export type AddOn = {
  id: string;
  name: string;
  price: number;
  groupId?: string | null;
};
export type ModifierGroup = {
  id: string;
  name: string;
  nameEn: string | null;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
};

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
  basePrice,
  stock,
  variants,
  addons,
  modifierGroups = [],
  allowScheduling = false,
  defaultAddress = "",
  acceptsDelivery = true,
  acceptsPickup = true,
  lbpRate = 0,
}: {
  lang: Locale;
  dict: Dictionary;
  storeId: string;
  productId: string;
  basePrice: number;
  stock: number | null;
  variants: Variant[];
  addons: AddOn[];
  modifierGroups?: ModifierGroup[];
  allowScheduling?: boolean;
  defaultAddress?: string;
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
  lbpRate?: number;
}) {
  const router = useRouter();
  // Apparel variants carry color/size → render a 2-step picker; legacy flat
  // variants (no color/size) keep the single pill row.
  const structured = variants.length > 0 && variants.some((v) => v.color || v.size);
  const colors = structured
    ? [...new Set(variants.filter((v) => v.color).map((v) => v.color as string))]
    : [];
  const [variantId, setVariantId] = useState<string | null>(
    structured ? null : (variants[0]?.id ?? null),
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(
    colors[0] ?? null,
  );
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const idemKeyRef = useRef<string>("");
  const [itemNote, setItemNote] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [qty, setQty] = useState(1);
  const [checkingOut, setCheckingOut] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const fulfillmentOptions = (["delivery", "pickup"] as const).filter((o) =>
    o === "delivery" ? acceptsDelivery : acceptsPickup,
  );
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    acceptsDelivery ? "delivery" : "pickup",
  );

  const variant = variants.find((v) => v.id === variantId) ?? null;
  // Sizes offered for the chosen color (or all variants when there's no color
  // axis, i.e. size-only products).
  const sizesForColor = colors.length
    ? variants.filter((v) => v.color === selectedColor)
    : variants;
  const hasSizeAxis = sizesForColor.some((v) => v.size);
  // A structured product needs an explicit final pick before it can be ordered.
  const mustPick = structured && variantId === null;
  const variantStock = variant ? variant.stock : stock;
  const soldOut =
    mustPick ||
    (variant ? !variant.is_available : false) ||
    (variantStock != null && variantStock <= 0);
  const maxQty = variantStock ?? Infinity;

  const unitBase = variant?.price ?? basePrice;
  const addonsSum = addons
    .filter((a) => selectedAddons.includes(a.id))
    .reduce((s, a) => s + a.price, 0);
  const unitPrice = unitBase + addonsSum;
  const total = unitPrice * qty;

  // Modifier groups (food): options carry a groupId; ungrouped options are flat
  // add-ons rendered as before. Selection rules (required / min / max) are
  // enforced here for UX and re-enforced server-side in the order RPC.
  const groupedAddons = (id: string) =>
    addons.filter((a) => a.groupId === id);
  const ungroupedAddons = addons.filter((a) => !a.groupId);
  const selectedInGroup = (id: string) =>
    groupedAddons(id).filter((a) => selectedAddons.includes(a.id)).length;
  const groupFloor = (g: ModifierGroup) =>
    Math.max(g.minSelect, g.required ? 1 : 0);
  const unmetGroup = modifierGroups.find(
    (g) => selectedInGroup(g.id) < groupFloor(g),
  );
  const modifiersOk = !unmetGroup;

  function toggleAddon(id: string) {
    const addon = addons.find((a) => a.id === id);
    const group = addon?.groupId
      ? modifierGroups.find((g) => g.id === addon.groupId)
      : null;
    setSelectedAddons((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (group) {
        const inGroup = addons
          .filter((a) => a.groupId === group.id)
          .map((a) => a.id);
        const chosen = s.filter((x) => inGroup.includes(x));
        // Single-select group (max 1): replace the current pick.
        if (group.maxSelect === 1) {
          return [...s.filter((x) => !inGroup.includes(x)), id];
        }
        // Multi-select with a cap: ignore clicks past the max.
        if (group.maxSelect != null && chosen.length >= group.maxSelect) {
          return s;
        }
      }
      return [...s, id];
    });
  }

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
    // Idempotency: reuse one key across retries of the same attempt so a stalled
    // request the user re-submits collapses to a single order (the RPC dedupes on
    // it). Regenerated only after a successful placement.
    if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID();
    // Server-side pricing: the RPC re-reads product/variant/add-on prices from
    // the catalog and enforces stock (incl. per-variant) in one transaction.
    const { error } = await supabase.rpc("place_customer_order", {
      p_store_id: storeId,
      p_phone: String(form.get("phone") ?? ""),
      p_address: String(form.get("address") ?? ""),
      p_fulfillment: fulfillment,
      p_note: String(form.get("note") ?? ""),
      p_coupon: null,
      p_items: [
        {
          product_id: productId,
          quantity: qty,
          variant_id: variantId,
          addon_ids: selectedAddons,
          note: itemNote.trim() || undefined,
        },
      ],
      p_custom_fields:
        allowScheduling && scheduledFor
          ? { scheduled_for: new Date(scheduledFor).toISOString() }
          : undefined,
      p_idempotency_key: idemKeyRef.current,
    });
    if (error) {
      const outOfStock = error.message?.includes("insufficient_stock");
      setOrderError(
        outOfStock ? dict.store.outOfStock : dict.auth.errorGeneric,
      );
      setPlacing(false);
      // Re-sync so the stale in-stock state doesn't linger after a stock error.
      if (outOfStock) router.refresh();
      return;
    }
    idemKeyRef.current = "";
    router.push(`/${lang}/orders`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Variants — apparel: color → size; legacy: single pill row */}
      {structured ? (
        <div className="space-y-4">
          {colors.length > 0 && (
            <div>
              <span className="text-sm font-semibold">{dict.product.selectColor}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {colors.map((c) => {
                  const vs = variants.filter((v) => v.color === c);
                  const cOut = vs.every(
                    (v) => !v.is_available || (v.stock != null && v.stock <= 0),
                  );
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={cOut}
                      onClick={() => {
                        setSelectedColor(c);
                        // Color-only (single variant) selects it directly;
                        // otherwise wait for a size pick.
                        setVariantId(vs.length === 1 ? vs[0].id : null);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                        selectedColor === c
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {hasSizeAxis && (
            <div>
              <span className="text-sm font-semibold">{dict.product.selectSize}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {sizesForColor.map((v) => {
                  const vOut = !v.is_available || (v.stock != null && v.stock <= 0);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={vOut}
                      onClick={() => {
                        setVariantId(v.id);
                        if (v.stock != null)
                          setQty((q) => Math.min(q, Math.max(1, v.stock!)));
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                        variantId === v.id
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {v.size ?? v.label}
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
          {mustPick && (
            <p className="text-xs font-semibold text-muted-foreground">
              {hasSizeAxis ? dict.product.pickSizeHint : dict.product.pickColorHint}
            </p>
          )}
        </div>
      ) : (
        variants.length > 0 && (
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
                    onClick={() => {
                      setVariantId(v.id);
                      if (v.stock != null) setQty((q) => Math.min(q, Math.max(1, v.stock!)));
                    }}
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
        )
      )}

      {/* Modifier groups (food): each group its own selection rules */}
      {modifierGroups.map((g) => {
        const opts = groupedAddons(g.id);
        if (opts.length === 0) return null;
        const single = g.maxSelect === 1;
        const label = lang === "en" && g.nameEn?.trim() ? g.nameEn : g.name;
        const floor = groupFloor(g);
        const hint = single
          ? floor >= 1
            ? dict.product.modRequiredOne
            : dict.product.modPickOne
          : g.maxSelect != null
            ? dict.product.modUpTo.replace("{n}", String(g.maxSelect))
            : floor >= 1
              ? dict.product.modAtLeast.replace("{n}", String(floor))
              : dict.product.modOptional;
        const unmet = selectedInGroup(g.id) < floor;
        return (
          <div key={g.id}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{label}</span>
              <span
                className={`text-xs font-semibold ${unmet ? "text-danger" : "text-muted-foreground"}`}
              >
                {hint}
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {opts.map((a) => {
                const checked = selectedAddons.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                      checked ? "border-primary bg-primary-soft" : "border-border"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={`mod-${g.id}`}
                        checked={checked}
                        onChange={() => toggleAddon(a.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      {a.name}
                    </span>
                    {a.price > 0 && (
                      <span className="font-bold text-primary">
                        + {formatPrice(a.price)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Flat add-ons (no group) */}
      {ungroupedAddons.length > 0 && (
        <div>
          <span className="text-sm font-semibold">{dict.product.addons}</span>
          <div className="mt-2 space-y-2">
            {ungroupedAddons.map((a) => (
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

      {/* Per-item special instructions */}
      <div>
        <label className="text-sm font-semibold" htmlFor="item-note">
          {dict.product.itemNote}
        </label>
        <input
          id="item-note"
          value={itemNote}
          onChange={(e) => setItemNote(e.target.value)}
          placeholder={dict.product.itemNotePlaceholder}
          className={fieldClass}
        />
      </div>

      {/* Schedule for later (food) */}
      {allowScheduling && (
        <div>
          <label className="text-sm font-semibold" htmlFor="scheduled-for">
            {dict.product.scheduleFor}
          </label>
          <input
            id="scheduled-for"
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className={fieldClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {dict.product.scheduleHint}
          </p>
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
            <div>
              <span className="text-lg font-extrabold">
                {dict.product.total}: {formatPrice(total)}
              </span>
              {lbpRate > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatLbp(total, lbpRate, lang)}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={soldOut || !modifiersOk}
              onClick={() => setCheckingOut(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4" />
              {soldOut
                ? dict.product.outOfStock
                : !modifiersOk
                  ? dict.product.modChoose
                  : dict.product.buyNow}
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
          {lbpRate > 0 && (
            <p className="-mt-3 text-xs text-muted-foreground">
              {formatLbp(total, lbpRate, lang)}
            </p>
          )}
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
            <p className="text-sm font-medium text-danger">{orderError}</p>
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
