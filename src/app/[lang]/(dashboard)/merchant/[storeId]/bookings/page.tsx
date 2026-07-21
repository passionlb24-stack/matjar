import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { AutoRefresh } from "@/components/auto-refresh";
import { BookingStatusControl } from "@/components/booking-status-control";
import {
  BookingsCalendar,
  type CalendarBooking,
} from "@/components/bookings-calendar";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BookingRow = {
  id: string;
  status: string;
  service_name: string | null;
  requested_date: string | null;
  requested_time: string | null;
  customer_name: string | null;
  notes: string | null;
  party_size: number | null;
  doctors: { name: string } | null;
};

export default async function StoreBookingsPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: canManage } = await supabase.rpc("can_manage_store", {
    p_store_id: storeId,
  });
  if (!canManage) redirect(`/${lang}/merchant`);
  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  // Chronological schedule: soonest appointment first (not newest request).
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, status, service_name, requested_date, requested_time, customer_name, notes, party_size, doctors(name)",
    )
    .eq("store_id", storeId)
    .order("requested_date", { ascending: true, nullsFirst: false })
    .order("requested_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  // PostgREST types the doctors embed as an array; at runtime a to-one FK
  // returns a single object (or null), which is what BookingRow expects.
  const bookings = (data ?? []) as unknown as BookingRow[];

  // Flatten the doctor join for the calendar client component (dated bookings
  // land on the grid; undated ones still show in the chronological list below).
  const calendarBookings: CalendarBooking[] = bookings.map((b) => ({
    id: b.id,
    service_name: b.service_name,
    requested_date: b.requested_date,
    requested_time: b.requested_time,
    customer_name: b.customer_name,
    status: b.status,
    doctor: b.doctors?.name ?? null,
  }));

  return (
    <div className="py-10">
      <Container className="max-w-3xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {(store as { name: string }).name}
        </Link>
        <AutoRefresh />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {dict.booking.myBookings}
        </h1>

        {bookings.length ? (
          <>
            <BookingsCalendar
              lang={lang}
              dict={dict}
              bookings={calendarBookings}
            />
            <div className="mt-8 space-y-4">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold">
                      {b.service_name ?? "—"}
                      {b.doctors?.name && (
                        <span className="ms-2 text-sm font-semibold text-primary">
                          · {b.doctors.name}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {b.customer_name}
                      {b.requested_date ? ` · ${b.requested_date}` : ""}
                      {b.requested_time ? ` ${b.requested_time}` : ""}
                      {b.party_size
                        ? ` · ${b.party_size} ${dict.reservations.people}`
                        : ""}
                    </p>
                  </div>
                  <BookingStatusControl
                    bookingId={b.id}
                    status={b.status}
                    labels={dict.booking.status}
                    errorLabel={dict.auth.errorGeneric}
                  />
                </div>
                {b.notes && (
                  <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                    {b.notes}
                  </p>
                )}
              </div>
            ))}
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {dict.booking.noBookings}
          </div>
        )}
      </Container>
    </div>
  );
}
