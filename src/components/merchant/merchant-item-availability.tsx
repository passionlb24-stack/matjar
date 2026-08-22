"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { revalidateProduct, revalidateStore } from "@/lib/cache-actions";
import { notifyError } from "@/lib/notify";
import { Switch } from "@/components/ui/switch";

// ===== "That just ran out" =====
//
// One of the three things a merchant does every day from behind a counter. On
// the desktop catalogue it is a 32px eye icon in a row of icons; on a phone it
// was the same 32px icon, next to a delete button, wearing the same grey.
//
// This is the identical operation with a control that states which way it is
// pointing: `products.is_available`, the existing column, written through the
// existing path — the same `.update({ is_available })` + revalidateProduct +
// revalidateStore + router.refresh() sequence ProductRowActions.toggle() runs.
//
// Both cache busts matter and neither is optional. `revalidateProduct` clears
// the product's own cached view; `revalidateStore` clears the storefront view
// the product list is BAKED INTO (a separate 300s-TTL cache, tagged
// `store:<id>`). Dropping the second one is how a merchant hides a sold-out
// item, opens their own shop to check, still sees it, and concludes the switch
// does not work.
//
// No new column, no new RPC, no optimistic lie: the switch shows `busy` while
// the write is in flight and the row re-renders from the server afterwards.

export function MerchantItemAvailability({
  productId,
  storeId,
  isAvailable,
  /** Accessible name — "Show {name} to customers", with the item's own name. */
  label,
  shownLabel,
  hiddenLabel,
  errorLabel,
}: {
  productId: string;
  storeId: string;
  isAvailable: boolean;
  label: string;
  shownLabel: string;
  hiddenLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    const { error } = await createClient()
      .from("products")
      .update({ is_available: next })
      .eq("id", productId);
    setBusy(false);
    if (error) {
      notifyError(errorLabel);
      return;
    }
    await revalidateProduct(productId);
    await revalidateStore(storeId);
    router.refresh();
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      {/* The word is the state; the switch is the control. A bare toggle on a
          phone leaves the merchant guessing which end means "on". */}
      <span
        className={`text-[11px] font-bold ${
          isAvailable ? "text-success" : "text-muted-foreground"
        }`}
      >
        {isAvailable ? shownLabel : hiddenLabel}
      </span>
      <Switch
        checked={isAvailable}
        onChange={toggle}
        disabled={busy}
        label={label}
      />
    </span>
  );
}
