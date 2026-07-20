import Link from "next/link";
import {
  ClipboardList,
  ChefHat,
  FileText,
  CalendarCheck,
  Clock,
  ChevronLeft,
} from "lucide-react";

// ===== OS dashboard — TodayPanel =====
// "What's on my plate right now": pending orders (+ kitchen for food),
// pending service requests, and today's appointment list for booking sectors.
// The page decides which sections exist and their order (sector + permission
// aware); this component only renders what it's given.

export type TodayCounterRow = {
  key: "orders" | "kitchen" | "requests";
  label: string;
  /** null = pure link row (kitchen), number = counter row. */
  count: number | null;
  href: string;
};

export type TodayBookingRow = {
  id: string;
  time: string | null;
  customer: string;
  service: string | null;
};

function CounterRow({ row }: { row: TodayCounterRow }) {
  const Icon =
    row.key === "orders"
      ? ClipboardList
      : row.key === "kitchen"
        ? ChefHat
        : FileText;
  const hot = (row.count ?? 0) > 0;
  return (
    <Link
      href={row.href}
      className={`flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm ${
        hot
          ? "border-primary/30 bg-primary-soft/50"
          : "border-border bg-surface"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          hot ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold">{row.label}</span>
      {row.count !== null && (
        <span
          className={`text-xl font-extrabold tabular-nums ${hot ? "text-primary" : "text-muted-foreground"}`}
        >
          {row.count}
        </span>
      )}
      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground ltr:rotate-180" />
    </Link>
  );
}

export function TodayPanel({
  counters,
  bookings,
  bookingsTitle,
  noBookings,
  bookingsHref,
  viewAll,
  bookingsFirst,
}: {
  counters: TodayCounterRow[];
  /** null = this store has no bookings section at all. */
  bookings: TodayBookingRow[] | null;
  bookingsTitle: string;
  noBookings: string;
  bookingsHref: string;
  viewAll: string;
  /** Booking-first sectors (clinics…) lead with the appointment list. */
  bookingsFirst: boolean;
}) {
  const bookingsBlock = bookings !== null && (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <CalendarCheck className="h-3.5 w-3.5" />
          {bookingsTitle}
        </h3>
        <Link
          href={bookingsHref}
          className="text-xs font-bold text-primary transition-colors hover:text-primary-hover"
        >
          {viewAll}
        </Link>
      </div>
      {bookings.length ? (
        <ul className="mt-2.5 space-y-1.5">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-xl bg-surface-muted/60 px-3 py-2.5"
            >
              <span className="flex shrink-0 items-center gap-1 rounded-lg bg-surface px-2 py-1 text-xs font-bold tabular-nums text-primary shadow-xs">
                <Clock className="h-3 w-3" />
                {b.time ?? "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {b.customer}
              </span>
              {b.service && (
                <span className="hidden max-w-[40%] truncate text-xs font-medium text-muted-foreground sm:block">
                  {b.service}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 rounded-xl bg-surface-muted/60 px-3 py-3 text-sm text-muted-foreground">
          {noBookings}
        </p>
      )}
    </div>
  );

  const countersBlock = counters.length > 0 && (
    <div className="space-y-2">
      {counters.map((row) => (
        <CounterRow key={row.key} row={row} />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {bookingsFirst ? (
        <>
          {bookingsBlock}
          {countersBlock}
        </>
      ) : (
        <>
          {countersBlock}
          {bookingsBlock}
        </>
      )}
    </div>
  );
}
