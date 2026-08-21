"use client";

import Link from "next/link";
import { Check, MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PlacedOrder } from "@/components/checkout/checkout-form";

// What a customer sees the moment an order exists — the same screen whichever
// page placed it.
//
// The product page used to answer a successful order with `router.push('/orders')`
// and nothing else. That was wrong twice over: a guest has no /orders to be
// pushed to (which is part of why the buy box refused guests at all), and even
// a signed-in customer was handed a list and left to find their own row. Both
// surfaces now end here, so the reference number, the amount and the "tell the
// merchant" button are not a property of the route the order came in through.
export function OrderPlaced({
  lang,
  dict,
  order,
  loggedIn,
}: {
  lang: Locale;
  dict: Dictionary;
  order: PlacedOrder;
  loggedIn: boolean;
}) {
  const { orderId, total, waUrl } = order;
  return (
    <div className="mt-6 rounded-2xl border border-success/30 bg-success-soft p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-strong text-success-strong-foreground">
        <Check className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-lg font-extrabold">
        {dict.store.orderPlacedTitle}
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {dict.store.orderPlacedNote}
      </p>

      {/* The reference, as text a customer can keep. The tracking link below
          only helps someone who still has the tab; a cash-on-delivery buyer who
          closes it had nothing at all to quote. These are the same 8 characters
          the merchant sees on their orders screen, so reading it down the phone
          resolves to the same order. */}
      {orderId && (
        <div className="mx-auto mt-4 max-w-xs rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {dict.os.track.orderRef}
          </p>
          <p
            dir="ltr"
            className="mt-0.5 select-all text-xl font-extrabold tracking-wider"
          >
            #{orderId.slice(0, 8)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {dict.os.track.orderRefHint}
          </p>
        </div>
      )}

      {/* What was paid, and what happens now — the two questions the customer
          actually has at this exact moment. */}
      <div className="mx-auto mt-4 max-w-xs rounded-xl border border-border bg-surface px-4 py-3 text-start">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {dict.store.total}
          </span>
          <Money value={total} cents className="text-lg font-extrabold" />
        </div>
        <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
          {dict.orders.nextPending}
        </p>
      </div>

      <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "whatsapp" })}
          >
            <MessageCircle className="h-4 w-4" />
            {dict.store.notifyMerchantWa}
          </a>
        )}
        {/* The order they JUST placed, not the list it landed in — each through
            the route their own session can read. */}
        {loggedIn ? (
          <Link
            href={
              orderId ? `/${lang}/orders/${orderId}` : `/${lang}/orders`
            }
            className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
          >
            {orderId ? dict.os.track.trackLink : dict.store.viewMyOrders}
          </Link>
        ) : (
          orderId && (
            <Link
              href={`/${lang}/track/${orderId}`}
              className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
            >
              {dict.os.track.trackLink}
            </Link>
          )
        )}
      </div>
      {!loggedIn && orderId && (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          {dict.os.track.saveLink}
        </p>
      )}
    </div>
  );
}
