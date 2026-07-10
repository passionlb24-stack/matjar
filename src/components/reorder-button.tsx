"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

// Re-adds a past order's items to the store's (persisted) cart and opens the
// store, so the customer can review and place them again in one tap.
export function ReorderButton({
  storeId,
  items,
  lang,
  dict,
}: {
  storeId: string;
  items: { product_id: string | null; quantity: number }[];
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();

  function reorder() {
    const cart: Record<string, number> = {};
    for (const it of items) {
      if (it.product_id) cart[it.product_id] = (cart[it.product_id] ?? 0) + it.quantity;
    }
    try {
      localStorage.setItem(`matjar-cart-${storeId}`, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
    router.push(`/${lang}/store/${storeId}`);
  }

  return (
    <button
      onClick={reorder}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
    >
      <RotateCcw className="h-4 w-4" />
      {dict.orders.reorder}
    </button>
  );
}
