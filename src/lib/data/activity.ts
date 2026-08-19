import "server-only";
import { createClient } from "@/lib/supabase/server";

// Everything the customer started, in one place.
//
// Matjar creates four kinds of customer transaction and, until now, each lived
// at its own route behind Account. A marketplace where the customer cannot
// answer "where is my thing?" in one tap is a catalogue.
//
// Deliberately NOT merged into a single status vocabulary: "قيد التحضير" on a
// food order and "عم يشتغل" on a plumber are different promises, and flattening
// them into one pill is how a customer ends up believing a booking is an order.
// Each row keeps its own domain wording and carries its type with it.

export type ActivityKind = "order" | "booking" | "craft" | "lead";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  storeName: string;
  /** Deep link to the existing detail screen for this kind. */
  href: string;
  title: string;
  status: string;
  createdAt: string;
  /** Raw `lead_kind`, leads only — the row's only description when the customer
   *  sent no message. Carried raw so the SCREEN can translate it; this module
   *  stays data-only and the site layout can keep calling it just to count
   *  badges without pulling the whole dictionary in behind it. */
  leadKind: string | null;
  /** Money, where the transaction has any. Bookings and leads usually don't. */
  total: number | null;
  /** True when the ball is in the CUSTOMER's court — drives the tab badge. */
  needsCustomer: boolean;
};

export async function getCustomerActivity(
  lang: string,
): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Four independent reads rather than a view: each table has its own RLS and
  // its own shape, and a union view would need a security definer wrapper for
  // no gain at this size.
  const [orders, bookings, crafts, leads] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, total, created_at, stores(name)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("bookings")
      .select(
        "id, status, service_name, requested_date, created_at, stores(name)",
      )
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("craft_requests")
      .select("id, status, description, created_at, craft_providers(name)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("leads")
      .select("id, status, kind, message, created_at, stores(name)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const out: ActivityItem[] = [];

  for (const o of (orders.data ?? []) as unknown as {
    id: string;
    status: string;
    total: number;
    created_at: string;
    stores: { name: string } | null;
  }[]) {
    out.push({
      id: o.id,
      kind: "order",
      storeName: o.stores?.name ?? "",
      href: `/${lang}/orders/${o.id}`,
      title: `#${o.id.slice(0, 8)}`,
      status: o.status,
      createdAt: o.created_at,
      leadKind: null,
      total: Number(o.total ?? 0),
      // A finished order the customer hasn't reviewed is still "theirs to do".
      needsCustomer: o.status === "completed",
    });
  }

  for (const b of (bookings.data ?? []) as unknown as {
    id: string;
    status: string;
    service_name: string | null;
    requested_date: string | null;
    created_at: string;
    stores: { name: string } | null;
  }[]) {
    out.push({
      id: b.id,
      kind: "booking",
      storeName: b.stores?.name ?? "",
      href: `/${lang}/bookings`,
      title: b.service_name ?? "",
      status: b.status,
      createdAt: b.created_at,
      leadKind: null,
      total: null,
      // A confirmed appointment is something to show up to.
      needsCustomer: b.status === "accepted" || b.status === "scheduled",
    });
  }

  for (const c of (crafts.data ?? []) as unknown as {
    id: string;
    status: string;
    description: string;
    created_at: string;
    craft_providers: { name: string } | null;
  }[]) {
    out.push({
      id: c.id,
      kind: "craft",
      storeName: c.craft_providers?.name ?? "",
      href: `/${lang}/crafts/requests`,
      title: c.description.slice(0, 60),
      status: c.status,
      createdAt: c.created_at,
      leadKind: null,
      total: null,
      // Finished work is waiting to be rated.
      needsCustomer: c.status === "completed",
    });
  }

  for (const l of (leads.data ?? []) as unknown as {
    id: string;
    status: string;
    kind: string | null;
    message: string | null;
    created_at: string;
    stores: { name: string } | null;
  }[]) {
    out.push({
      id: l.id,
      kind: "lead",
      storeName: l.stores?.name ?? "",
      href: `/${lang}/messages`,
      // The kind is NOT folded into the title any more. `lead_kind` is a
      // Postgres enum, so a customer who tapped "request a viewing" and typed
      // nothing got the literal string `test_drive` as their row's heading.
      // It travels as leadKind instead, and the screen puts words on it.
      title: (l.message ?? "").slice(0, 60),
      status: l.status,
      createdAt: l.created_at,
      leadKind: l.kind,
      total: null,
      needsCustomer: false,
    });
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** What the tab badge shows: only what the customer themselves must act on.
 *  needsCustomer is already decided per domain above — an order to review, an
 *  appointment to attend, finished work to rate. Counting anything else would
 *  make the badge a number the customer cannot clear. */
export function countNeedingCustomer(items: ActivityItem[]): number {
  return items.filter((i) => i.needsCustomer).length;
}
