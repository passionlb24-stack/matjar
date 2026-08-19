"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Package, CalendarCheck, Wrench, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { ActivityItem, ActivityKind } from "@/lib/data/activity";

const ICONS: Record<ActivityKind, LucideIcon> = {
  order: Package,
  booking: CalendarCheck,
  craft: Wrench,
  lead: MessageSquare,
};

/** What tapping this row does, in the row's own vocabulary.
 *
 *  Deliberately a statement about the DESTINATION, never a prediction: "track
 *  your order" is true because the order page tracks it, where "arriving today"
 *  would be a promise nobody made. A booking is never called an order here
 *  either — each kind keeps its own noun, the same rule lib/data/activity.ts
 *  applies to statuses. */
function nextAction(it: ActivityItem, labels: Record<string, string>): string {
  if (it.kind === "order")
    return it.status === "completed" ? labels.actionReview : labels.actionTrack;
  if (it.kind === "booking") return labels.actionBooking;
  if (it.kind === "craft")
    return it.status === "completed"
      ? labels.actionRateWork
      : labels.actionCraft;
  return labels.actionLead;
}

// One screen for everything the customer started.
//
// The type filter is a segmented rail, not a dropdown: on a phone the whole
// point is that switching between "my orders" and "my appointments" is a thumb
// move, not a menu. Filtering happens client-side because the whole set is one
// page of rows — a round trip per tab would make the fast thing slow. The rail
// sticks under the header below lg so the filter is still reachable forty rows
// down, which is exactly where a customer with real history is looking.
export function ActivityList({
  items,
  labels,
  statusLabels,
  leadKindLabels,
  lang,
}: {
  items: ActivityItem[];
  labels: Record<string, string>;
  /** Each domain keeps its own wording — see lib/data/activity.ts. */
  statusLabels: Record<ActivityKind, Record<string, string>>;
  /** `lead_kind` → words, for the leads that arrived without a message. */
  leadKindLabels: Record<string, string>;
  lang: Locale;
}) {
  const [kind, setKind] = useState<ActivityKind | "all">("all");

  const counts: Record<string, number> = { all: items.length };
  for (const i of items) counts[i.kind] = (counts[i.kind] ?? 0) + 1;

  const tabs: { key: ActivityKind | "all"; label: string }[] = [
    { key: "all", label: labels.all },
    { key: "order", label: labels.orders },
    { key: "booking", label: labels.bookings },
    { key: "craft", label: labels.crafts },
    { key: "lead", label: labels.leads },
  ];

  const shown = kind === "all" ? items : items.filter((i) => i.kind === kind);
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", {
    month: "short",
    day: "numeric",
  });

  return (
    <>
      {/* Horizontal rail, never wrapped: five chips must stay one row at 360px. */}
      <div className="sticky top-[calc(var(--m-header-h)+env(safe-area-inset-top))] z-30 -mx-[var(--m-page-x)] mt-4 flex gap-2 overflow-x-auto bg-background/95 px-[var(--m-page-x)] py-2 backdrop-blur-md [scrollbar-width:none] lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const on = kind === t.key;
          const n = counts[t.key] ?? 0;
          // A filter that leads to an empty screen is a dead end, so tabs with
          // nothing behind them are not offered at all.
          if (t.key !== "all" && n === 0) return null;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setKind(t.key)}
              aria-pressed={on}
              className={`flex h-[var(--m-touch)] shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors ${
                on
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {t.label}
              <span className="text-xs opacity-70 tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="font-bold">{labels.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels.emptyBody}
          </p>
          <Link
            href={labels.emptyHref}
            className="mt-4 inline-flex h-[var(--m-touch)] items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            {labels.emptyCta}
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((it) => {
            const Icon = ICONS[it.kind];
            const status = statusLabels[it.kind]?.[it.status] ?? it.status;
            // Half the leads in this market carry no message — the customer
            // taps "request a viewing" and waits for the phone to ring. The
            // kind is then the only thing describing the row, so it stands in
            // for the title, in words rather than as the raw enum.
            const title =
              it.title ||
              (it.leadKind ? (leadKindLabels[it.leadKind] ?? it.leadKind) : "");
            return (
              <li key={`${it.kind}-${it.id}`}>
                <Link
                  href={it.href}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors active:bg-surface-muted"
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    {/* Type is always stated. Four kinds sharing one pill is how
                        a customer ends up thinking a booking was an order. */}
                    <span className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-muted-foreground">
                      {labels[`kind_${it.kind}`]}
                      <span
                        dir="ltr"
                        className="font-normal tabular-nums"
                        suppressHydrationWarning
                      >
                        {dateFmt.format(new Date(it.createdAt))}
                      </span>
                      {it.needsCustomer && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent-foreground">
                          {labels.needsYou}
                        </span>
                      )}
                    </span>

                    {/* dir=auto: store/product names are merchant text and may
                        be Latin inside the RTL page. */}
                    <span dir="auto" className="mt-0.5 block truncate font-bold">
                      {it.storeName || title}
                    </span>
                    {it.storeName && title && (
                      <span
                        dir="auto"
                        className="block truncate text-sm text-muted-foreground"
                      >
                        {title}
                      </span>
                    )}

                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold">
                        {status}
                      </span>
                      {/* Money only where the transaction has any — a booking
                          and an inquiry carry none, and a $0.00 would read as a
                          price that was agreed. */}
                      {it.total != null && it.total > 0 && (
                        <span
                          dir="ltr"
                          className="text-money text-sm font-bold tabular-nums"
                        >
                          ${it.total.toFixed(2)}
                        </span>
                      )}
                    </span>

                    {/* What this row is for. Never an ETA, never a count. */}
                    <span className="mt-2 block text-xs font-bold text-primary">
                      {nextAction(it, labels)}
                    </span>
                  </span>

                  {/* Forward affordance: ChevronRight + rtl:rotate-180 points
                      into the row's destination in both directions. */}
                  <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-muted-foreground rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
