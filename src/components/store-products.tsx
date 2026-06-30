"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { categoryStyles, type CategoryKey } from "@/lib/catalog";
import { categoryIcons } from "@/components/category-icon";

type Product = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
};

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
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  category: CategoryKey;
  isBooking: boolean;
  products: Product[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    "delivery",
  );

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
  const total = items.reduce((sum, p) => sum + p.price * cart[p.id], 0);

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
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        store_id: storeId,
        customer_id: user.id,
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
    await supabase.from("order_items").insert(
      items.map((p) => ({
        order_id: order.id,
        product_id: p.id,
        name: p.name,
        unit_price: p.price,
        quantity: cart[p.id],
      })),
    );
    router.push(`/${lang}/orders`);
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
        alt=""
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
                  <h3 className="font-bold leading-tight">{p.name}</h3>
                  <p className="mt-1 font-bold text-primary">{formatPrice(p.price)}</p>
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
                  <h3 className="truncate font-bold">{p.name}</h3>
                  <p className="mt-0.5 text-sm font-bold">{formatPrice(p.price)}</p>
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

      {items.length > 0 &&
        (checkingOut ? (
          <form
            onSubmit={confirmOrder}
            className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm"
          >
            <p className="text-lg font-extrabold">
              {dict.store.total}: {formatPrice(total)}
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
        ) : (
          <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-lg">
            <div>
              <p className="text-sm text-muted-foreground">{dict.store.yourOrder}</p>
              <p className="text-lg font-extrabold">
                {dict.store.total}: {formatPrice(total)}
              </p>
            </div>
            <button
              onClick={() => setCheckingOut(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <ShoppingCart className="h-4 w-4" />
              {dict.store.checkout}
            </button>
          </div>
        ))}
    </div>
  );
}
