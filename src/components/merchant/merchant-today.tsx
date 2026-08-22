import Link from "next/link";
import { Bell } from "lucide-react";
import { ChevronNext } from "@/components/ui/directional-icon";
import { Money } from "@/components/ui/money";
import { QuickActions, type QuickAction } from "@/components/os-dashboard/quick-actions";

// ===== Merchant home, phone edition =====
//
// The desktop home is a nine-widget, sector-ordered dashboard and it stays
// exactly as it is. This is the first screenful a merchant gets on a phone,
// and it answers the only three questions they have while a customer is
// standing in front of them:
//
//   1. Did anything arrive that needs me?   → the banner (only when it did)
//   2. How is today going?                  → two numbers, both real
//   3. Take me to the thing I do all day.   → the sector's quick actions
//
// ── Every number here is a query, and the ones that are not are absent ────
//
// `todayOrders` and `todaySales` are the LAST bucket of store_report's
// `per_day` series — the same RPC the revenue chart above already renders, so
// the two can never disagree, and it buckets by Beirut days (0219), not UTC, so
// "today" means the merchant's today and not one that ends at 21:00 local.
// `pending` is a head-count of orders in the `pending` status.
//
// Deliberately NOT rendered, and named so nobody assumes they were forgotten:
//
//   * today's storefront visits — store_visits_summary takes a DAY WINDOW
//     (p_days), not a calendar day, so "today" from it would actually be "the
//     last 24 hours" and would disagree with the two Beirut-day figures beside
//     it. The 7-day pulse it does answer honestly is already a KPI tile below.
//   * today's profit / margin — needs `products.cost`, which is null on every
//     product on the live platform, so it would render $0 for everybody.
//   * new customers today, repeat rate, conversion — no query in this codebase
//     computes any of them.

export type TodayNumbers = {
  /** Orders created today (Beirut). null when this user may not see orders. */
  orders: number | null;
  /** Today's online + POS takings, cancelled/rejected excluded. */
  sales: number | null;
};

export function MerchantToday({
  pending,
  ordersHref,
  today,
  quickActions,
  labels,
}: {
  /** Real count of orders in `pending`. Null when this staff member has no
   *  orders permission, or when the sector has no orders module at all. */
  pending: number | null;
  ordersHref: string;
  today: TodayNumbers;
  quickActions: QuickAction[];
  labels: {
    waitingOne: string;
    waitingMany: string;
    waitingCta: string;
    todayTitle: string;
    todayOrders: string;
    todaySales: string;
    todaySalesHint: string;
    pendingOrders: string;
    quickTitle: string;
  };
}) {
  const n = pending ?? 0;
  const hasNumbers = today.orders != null || today.sales != null;

  return (
    // Below lg only: on a desktop this would be a third copy of numbers the
    // KPI row and the chart already carry, above a rail that is not going
    // anywhere. The full dashboard renders underneath it at every width.
    <div className="lg:hidden">
      {/* The banner exists only when there is something to act on. A "0 orders
          waiting" card every morning is how a merchant learns to stop reading
          the top of this screen. */}
      {n > 0 && (
        <Link
          href={ordersHref}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4 shadow-xs transition-colors active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-strong text-danger-strong-foreground">
            <Bell className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-extrabold leading-snug text-danger">
              {n === 1
                ? labels.waitingOne
                : labels.waitingMany.replace("{n}", String(n))}
            </span>
            <span className="mt-0.5 block text-xs font-semibold text-danger/80">
              {labels.waitingCta}
            </span>
          </span>
          {/* Arabic reads right-to-left, so "forward" is the LEFT-pointing
              glyph. ChevronNext resolves that per locale. */}
          <ChevronNext className="h-5 w-5 shrink-0 text-danger" aria-hidden />
        </Link>
      )}

      {hasNumbers && (
        <section className="mt-4" aria-label={labels.todayTitle}>
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            {labels.todayTitle}
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {today.sales != null && (
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
                <div className="text-[11px] font-bold text-muted-foreground">
                  {labels.todaySales}
                </div>
                <div className="mt-1 text-2xl font-extrabold">
                  {/* Money isolates the amount LTR and gives it tabular
                      figures — a bare "$12.5" inside an RTL block reorders. */}
                  <Money value={today.sales} cents />
                </div>
                <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  {labels.todaySalesHint}
                </div>
              </div>
            )}
            {today.orders != null && (
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
                <div className="text-[11px] font-bold text-muted-foreground">
                  {labels.todayOrders}
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums">
                  {today.orders}
                </div>
                {pending != null && (
                  <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
                    {labels.pendingOrders}:{" "}
                    <span className="font-bold tabular-nums">{n}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {quickActions.length > 0 && (
        <section className="mt-4" aria-label={labels.quickTitle}>
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            {labels.quickTitle}
          </h2>
          <div className="mt-2">
            <QuickActions actions={quickActions} />
          </div>
        </section>
      )}
    </div>
  );
}
