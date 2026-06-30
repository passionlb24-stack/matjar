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

  const Icon = categoryIcons[category];
  const style = categoryStyles[category];

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

  async function checkout() {
    setPlacing(true);
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
      .insert({ store_id: storeId, customer_id: user.id, subtotal: total, total })
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

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const qty = cart[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4"
            >
              {p.imageUrl ? (
                <Image
                  src={p.imageUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  sizes="64px"
                />
              ) : (
                <span
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.cover}`}
                >
                  <Icon className="h-7 w-7 text-black/20" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold">{p.name}</h3>
                <p className="mt-0.5 text-sm font-bold">{formatPrice(p.price)}</p>
              </div>
              {qty > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty(p.id, qty - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted"
                    aria-label="-"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-5 text-center font-bold">{qty}</span>
                  <button
                    onClick={() => setQty(p.id, qty + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted"
                    aria-label="+"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setQty(p.id, 1)}
                  className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {isBooking ? dict.store.book : dict.store.order}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-lg">
          <div>
            <p className="text-sm text-muted-foreground">{dict.store.yourOrder}</p>
            <p className="text-lg font-extrabold">
              {dict.store.total}: {formatPrice(total)}
            </p>
          </div>
          <button
            disabled={placing}
            onClick={checkout}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <ShoppingCart className="h-4 w-4" />
            {placing ? dict.store.placing : dict.store.checkout}
          </button>
        </div>
      )}
    </div>
  );
}
