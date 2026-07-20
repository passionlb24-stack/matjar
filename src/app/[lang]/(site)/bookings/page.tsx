import { notFound, redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { OrderCancelButton } from "@/components/order-cancel-button";

type BookingStatus =
  | "pending"
  | "accepted"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "rejected";

type BookingRow = {
  id: string;
  status: BookingStatus;
  service_name: string | null;
  requested_date: string | null;
  requested_time: string | null;
  stores: { name: string } | null;
};

const statusStyle: Record<BookingStatus, string> = {
  pending: "bg-warning-soft text-warning",
  accepted: "bg-info-soft text-info",
  scheduled: "bg-info-soft text-info",
  completed: "bg-success-soft text-success",
  cancelled: "bg-slate-100 text-slate-600",
  rejected: "bg-danger-soft text-danger",
};

export default async function BookingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase
    .from("bookings")
    .select("id, status, service_name, requested_date, requested_time, stores(name)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  const bookings = (data ?? []) as unknown as BookingRow[];

  return (
    <div className="py-10">
      <Container className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.booking.myBookings}
        </h1>

        {bookings.length ? (
          <div className="mt-8 space-y-3">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5"
              >
                <div>
                  <p className="font-bold">{b.stores?.name ?? "—"}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {b.service_name}
                    {b.requested_date ? ` · ${b.requested_date}` : ""}
                    {b.requested_time ? ` ${b.requested_time}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[b.status]}`}
                  >
                    {dict.booking.status[b.status]}
                  </span>
                  {(b.status === "pending" ||
                    b.status === "accepted" ||
                    b.status === "scheduled") && (
                    <OrderCancelButton id={b.id} kind="booking" dict={dict} />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <CalendarCheck className="h-7 w-7" />
            </span>
            <p className="mt-4 text-muted-foreground">{dict.booking.noBookings}</p>
          </div>
        )}
      </Container>
    </div>
  );
}
