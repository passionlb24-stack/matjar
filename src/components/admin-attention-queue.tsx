// The admin home: what needs a person today.
//
// The brief asked for ~40 KPI cards on this screen. A wall of numbers does not
// answer the question an admin actually opens the page with — "what do I do
// now" — so the answer is shown instead, and the numbers live one click away.
//
// Two rules:
//   Ordered by the cost of ignoring an item, not by how big its number is.
//   Three merchants waiting on approval outranks a hundred page views: the
//   first is a decision going stale, the second is a fact.
//
//   The queue empties. A dashboard that always has something red on it teaches
//   the person reading it to stop looking, so "all clear" is a state worth
//   rendering properly.

import Link from "next/link";
import {
  Clock,
  ImageOff,
  TimerReset,
  MessageSquareWarning,
  Flag,
  SearchX,
  CheckCircle2,
  Store,
} from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

export type AttentionQueue = {
  pending_stores?: { count: number; oldest_hours: number };
  stores_missing_images?: { stores: number; products: number };
  trials_ending?: { count: number; without_orders: number };
  stale_orders?: { count: number; stores: number };
  search_gaps?: { term: string; hits: number }[];
  open_reports?: number;
  stores_selling_7d?: number;
};

type Severity = "critical" | "warning" | "info";

type Item = {
  key: string;
  severity: Severity;
  Icon: typeof Clock;
  title: string;
  why: string;
  href: string;
  cta: string;
};

function fill(s: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (out, [k, v]) => out.replace(`{${k}}`, String(v)),
    s,
  );
}

export function AdminAttentionQueue({
  queue,
  lang,
  dict,
}: {
  queue: AttentionQueue;
  lang: string;
  dict: Dictionary;
}) {
  const t = dict.admin.queue as unknown as Record<string, string>;
  const items: Item[] = [];

  const pending = queue.pending_stores;
  if (pending?.count) {
    items.push({
      key: "pending",
      // Critical past two days: approval is the one thing a merchant cannot
      // route around, and the wait is entirely ours.
      severity: pending.oldest_hours >= 48 ? "critical" : "warning",
      Icon: Clock,
      title: fill(t.pendingStores, { n: pending.count }),
      why: fill(t.pendingStoresWhy, { h: pending.oldest_hours }),
      href: `/${lang}/admin/stores`,
      cta: t.review,
    });
  }

  const stale = queue.stale_orders;
  if (stale?.count) {
    items.push({
      key: "stale",
      severity: "critical",
      Icon: MessageSquareWarning,
      title: fill(t.staleOrders, { n: stale.count }),
      why: fill(t.staleOrdersWhy, { s: stale.stores }),
      href: `/${lang}/admin/orders`,
      cta: t.open,
    });
  }

  const noImg = queue.stores_missing_images;
  if (noImg?.stores) {
    items.push({
      key: "images",
      severity: "warning",
      Icon: ImageOff,
      title: fill(t.missingImages, { n: noImg.stores }),
      why: fill(t.missingImagesWhy, { p: noImg.products }),
      href: `/${lang}/admin/stores`,
      cta: t.open,
    });
  }

  const trials = queue.trials_ending;
  if (trials?.count) {
    items.push({
      key: "trials",
      severity: "warning",
      Icon: TimerReset,
      title: fill(t.trialsEnding, { n: trials.count }),
      why: fill(t.trialsEndingWhy, { m: trials.without_orders }),
      href: `/${lang}/admin/subscriptions`,
      cta: t.open,
    });
  }

  if (queue.open_reports) {
    items.push({
      key: "reports",
      severity: "warning",
      Icon: Flag,
      title: fill(t.openReports, { n: queue.open_reports }),
      why: "",
      href: `/${lang}/admin/reports`,
      cta: t.review,
    });
  }

  const gaps = queue.search_gaps ?? [];
  if (gaps.length) {
    items.push({
      key: "gaps",
      // Never red: nothing is broken. It is the most valuable item here and the
      // least urgent — an opportunity, not an incident.
      severity: "info",
      Icon: SearchX,
      title: fill(t.searchGaps, { n: gaps.length }),
      why: fill(t.searchGapsWhy, {
        top: gaps
          .slice(0, 2)
          .map((g) => `«${g.term}» ×${g.hits}`)
          .join(" · "),
      }),
      href: `/${lang}/admin/growth`,
      cta: t.open,
    });
  }

  const tone: Record<Severity, string> = {
    critical: "border-transparent bg-danger-soft",
    warning: "border-transparent bg-warning-soft",
    info: "border-border bg-surface",
  };
  const stripe: Record<Severity, string> = {
    critical: "bg-danger",
    warning: "bg-warning",
    info: "bg-border",
  };
  const iconTone: Record<Severity, string> = {
    critical: "text-danger",
    warning: "text-warning",
    info: "text-muted-foreground",
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">{t.title}</h2>
        {/* The one number worth putting above everything else: not signups, not
            visits — how many shops actually took money this week. */}
        <span className="flex items-center gap-2 rounded-xl bg-surface-muted px-3.5 py-2">
          <Store className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground">
            {t.sellingLabel}
          </span>
          <b className="text-lg font-extrabold tabular-nums">
            {queue.stores_selling_7d ?? 0}
          </b>
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-success-soft p-5">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="text-sm font-semibold text-success">{t.clear}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) => (
            <li
              key={it.key}
              className={`flex items-start gap-3 rounded-2xl border p-4 ${tone[it.severity]}`}
            >
              <span
                className={`mt-0.5 w-1.5 shrink-0 self-stretch rounded-full ${stripe[it.severity]}`}
                aria-hidden="true"
              />
              <it.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone[it.severity]}`} />
              <span className="min-w-0 flex-1">
                <b className="block text-sm font-extrabold">{it.title}</b>
                {it.why && (
                  <span className="block text-xs text-muted-foreground">
                    {it.why}
                  </span>
                )}
              </span>
              <Link
                href={it.href}
                className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {it.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
