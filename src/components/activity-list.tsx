"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Package, CalendarCheck, Wrench, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityItem, ActivityKind } from "@/lib/data/activity";

const ICONS: Record<ActivityKind, LucideIcon> = {
  order: Package,
  booking: CalendarCheck,
  craft: Wrench,
  lead: MessageSquare,
};

// One screen for everything the customer started.
//
// The type filter is a segmented rail, not a dropdown: on a phone the whole
// point is that switching between "my orders" and "my appointments" is a thumb
// move, not a menu. Filtering happens client-side because the whole set is one
// page of rows — a round trip per tab would make the fast thing slow.
export function ActivityList({
  items,
  labels,
  statusLabels,
}: {
  items: ActivityItem[];
  labels: Record<string, string>;
  /** Each domain keeps its own wording — see lib/data/activity.ts. */
  statusLabels: Record<ActivityKind, Record<string, string>>;
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

  return (
    <>
      {/* Horizontal rail, never wrapped: five chips must stay one row at 360px. */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors ${
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
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            {labels.emptyCta}
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((it) => {
            const Icon = ICONS[it.kind];
            const status =
              statusLabels[it.kind]?.[it.status] ?? it.status;
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
                      <span className="font-normal">
                        {new Date(it.createdAt).toLocaleDateString("ar", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {it.needsCustomer && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent-foreground">
                          {labels.needsYou}
                        </span>
                      )}
                    </span>

                    <span className="mt-0.5 block truncate font-bold">
                      {it.storeName || it.title}
                    </span>
                    {it.storeName && it.title && (
                      <span className="block truncate text-sm text-muted-foreground">
                        {it.title}
                      </span>
                    )}

                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold">
                        {status}
                      </span>
                      {it.total != null && it.total > 0 && (
                        <span className="text-money text-sm font-bold">
                          ${it.total.toFixed(2)}
                        </span>
                      )}
                    </span>
                  </span>

                  <ChevronLeft className="mt-3 h-5 w-5 shrink-0 text-muted-foreground rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
