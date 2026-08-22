import { Clock } from "lucide-react";
import type { Locale } from "@/i18n/config";
import {
  orderProgress,
  progressPercent,
  isAwaitingMerchant,
  type OrderStatus,
  type Fulfillment,
} from "@/lib/order-progress";

/**
 * How far along an order is, on the orders list.
 *
 * The pill beside it answers "what is it now". It does not answer the question
 * somebody opens this page to ask, which is "how much longer" — and a word like
 * `preparing` only means something if you know how many steps come after it.
 *
 * A bar plus one line, rather than a label under every dot. The delivery
 * journey has five steps once `ready` is counted, and five Arabic labels across
 * a 390px card either truncate to nothing or wrap the card open. The line says
 * the same thing in words that fit: "الخطوة ٣ من ٥ · جاهز".
 *
 * No ETA. There is no such column in this schema, and an invented "20 دقيقة"
 * would be a promise the platform cannot keep and the merchant never made.
 *
 * Server-rendered: it derives entirely from two columns the page already has,
 * so shipping JavaScript to animate a bar that cannot change without a reload
 * would be waste.
 */
export function OrderTrack({
  status,
  fulfillment,
  labels,
  awaitingLabel,
  lang,
}: {
  status: OrderStatus;
  fulfillment: Fulfillment;
  /** dict.orders.status — the same vocabulary as the pill, never a second one. */
  labels: Record<string, string>;
  awaitingLabel: string;
  lang: Locale;
}) {
  if (isAwaitingMerchant(status)) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-warning">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        {awaitingLabel}
      </p>
    );
  }

  const p = orderProgress(status, fulfillment);
  // Cancelled, rejected, or a status that cannot belong to this fulfilment
  // method. The pill already says so honestly; a track would not.
  if (!p) return null;

  const pct = progressPercent(p);
  const label = labels[status] ?? status;
  const line =
    lang === "ar"
      ? `الخطوة ${p.reached} من ${p.total} · ${label}`
      : `Step ${p.reached} of ${p.total} · ${label}`;

  return (
    <div className="mt-2.5">
      {/* Fills from the inline start, so `dir` decides the direction and this
          is correct in both locales without a second rule. */}
      <div className="h-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-[inline-size] duration-500 motion-reduce:transition-none"
          style={{ inlineSize: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
        {line}
      </p>
    </div>
  );
}
