"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Search } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { OrderStatusControl } from "@/components/order-status-control";
import { OrderPayments, type OrderPayment } from "@/components/order-payments";
import { OrderNoteEditor } from "@/components/order-note-editor";

type OrderItem = { name: string; quantity: number; unit_price: number };

// One order, fully shaped on the server: money ledger and branch label resolved
// so this client component only filters and renders — no extra round-trips.
export type OrderCard = {
  id: string;
  status: string;
  total: number;
  fulfillment: "delivery" | "pickup";
  address: string | null;
  phone: string | null;
  customer_name: string | null;
  customer_note: string | null;
  store_note: string | null;
  created_at: string;
  location_id: string | null;
  order_items: OrderItem[];
  payments: OrderPayment[];
  branch: { name: string | null; area: string | null } | null;
};

// Mirrors the order_status enum, minus the implicit "all" tab rendered first.
const STATUS_FILTERS = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
  "rejected",
] as const;

function chip(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground border-primary"
    : "bg-surface text-foreground border-border hover:border-primary/40";
}

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

export function OrdersFilter({
  orders,
  dict,
  lang,
  storeId,
}: {
  orders: OrderCard[];
  dict: Dictionary;
  lang: string;
  storeId: string;
}) {
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");
  // Same contract OrderStatusControl uses for these labels.
  const statusLabels = dict.orders.status as Record<string, string>;

  const filtered = useMemo(() => {
    // Strip a leading "#" so searching the displayed "#a1b2c3d4" id still matches.
    const q = query.trim().toLowerCase().replace(/^#/, "");
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!q) return true;
      const name = (o.customer_name ?? "").toLowerCase();
      return name.includes(q) || o.id.toLowerCase().includes(q);
    });
  }, [orders, status, query]);

  return (
    <>
      <div className="mt-8 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 sm:max-w-md">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.orders.filter.searchPlaceholder}
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setStatus("all")}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${chip(status === "all")}`}
        >
          {dict.orders.filter.all}
        </button>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${chip(status === s)}`}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {filtered.length ? (
        <div className="mt-6 space-y-4">
          {filtered.map((order) => {
            const branch = order.branch;
            return (
              <div
                key={order.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0 text-sm font-semibold text-muted-foreground">
                    {dict.orders.order} #{order.id.slice(0, 8)}
                    {order.customer_name && (
                      <span className="ms-2 font-bold text-foreground">
                        {order.customer_name}
                      </span>
                    )}
                    <span className="ms-2 text-xs">
                      {new Date(order.created_at).toLocaleString(
                        lang === "ar" ? "ar" : "en",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                    {branch && (
                      <span className="ms-2 whitespace-nowrap rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {branch.name || branch.area
                          ? `${dict.os.branches.branchLabel}: ${branch.name || branch.area}`
                          : dict.os.branches.branchLabel}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/${lang}/merchant/${storeId}/orders/${order.id}/invoice`}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {dict.os.invoice.link}
                    </Link>
                    <OrderStatusControl
                      orderId={order.id}
                      status={order.status}
                      labels={dict.orders.status}
                      errorLabel={dict.auth.errorGeneric}
                    />
                  </span>
                </div>
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  {order.order_items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span>
                        {item.quantity}× {item.name}
                      </span>
                      <span className="text-muted-foreground">
                        {formatPrice(item.unit_price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold">
                  <span>{dict.orders.total}</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
                <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                  <p>
                    {order.fulfillment === "delivery"
                      ? dict.store.delivery
                      : dict.store.pickup}
                    {order.phone ? ` · ${order.phone}` : ""}
                  </p>
                  {order.address && <p>{order.address}</p>}
                  {order.customer_note && (
                    <p className="italic">“{order.customer_note}”</p>
                  )}
                </div>
                <OrderPayments
                  orderId={order.id}
                  payments={order.payments}
                  dict={dict}
                />
                <OrderNoteEditor
                  orderId={order.id}
                  note={order.store_note}
                  labels={dict.orders.storeNote}
                  errorLabel={dict.common.actionFailed}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {dict.orders.filter.noMatch}
        </div>
      )}
    </>
  );
}
