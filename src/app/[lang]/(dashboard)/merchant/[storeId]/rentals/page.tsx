import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarRange, Gauge, Phone, ShieldCheck, User } from "lucide-react";
import { ChevronPrev } from "@/components/ui/directional-icon";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { RentalStatusControl } from "@/components/rental/rental-status-control";
import { CardList, CardRow } from "@/components/ui/card";
import { NextStepEmpty } from "@/components/os-dashboard/next-step-empty";
import { labelMap } from "@/lib/status-labels";
import { formatUsd } from "@/lib/currency";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RentalRow = {
  id: string;
  renter_name: string;
  phone: string;
  pickup_date: string;
  return_date: string;
  days: number;
  driver_age: number;
  grand_total: number;
  deposit_amount: number;
  daily_km_limit: number | null;
  insurance_included: boolean;
  status: string;
  notes: string | null;
  rental_vehicles: { name: string } | null;
};

// Rental bookings (MJ-003, migration 0298) — the merchant's side of the engine.
//
// The money line shows the total the customer owes and the deposit SEPARATELY,
// with a sentence saying the deposit is theirs to collect in cash. Matjar takes
// no payment of any kind, so a single blended figure would be a number the
// merchant could not act on.
export default async function StoreRentalsPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);
  const t = dict.os.rentals;

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
    .select("name")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  const { data } = await supabase
    .from("rental_bookings")
    .select(
      "id, renter_name, phone, pickup_date, return_date, days, driver_age, grand_total, deposit_amount, daily_km_limit, insurance_included, status, notes, rental_vehicles(name)",
    )
    .eq("store_id", storeId)
    .order("pickup_date", { ascending: true });
  const rentals = (data ?? []) as unknown as RentalRow[];

  // Routed through the one table that maps a domain to its words, so an empty
  // label map cannot ship a raw Postgres enum into an Arabic page (MP-020).
  const statusLabels = labelMap(dict, "rentalBooking");
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="py-10">
      <Container className="max-w-4xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="relative inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:text-foreground"
        >
          <ChevronPrev className="h-4 w-4" />
          {(store as { name: string }).name}
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <CalendarRange className="h-7 w-7 text-primary" />
          {t.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        {rentals.length ? (
          <CardList className="mt-8">
            {rentals.map((r) => (
              <CardRow key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{r.renter_name}</span>
                      {r.rental_vehicles?.name && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                          {r.rental_vehicles.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                      <span dir="ltr" className="tabular-nums">
                        {fmt(r.pickup_date)} → {fmt(r.return_date)}
                      </span>
                      <span>
                        <span dir="ltr" className="tabular-nums">
                          {r.days}
                        </span>{" "}
                        {t.days}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {t.driverAge}{" "}
                        <span dir="ltr" className="tabular-nums">
                          {r.driver_age}
                        </span>
                      </span>
                      <span className="font-bold text-foreground">
                        {t.total}{" "}
                        <span dir="ltr" className="tabular-nums">
                          {formatUsd(r.grand_total, { cents: true })}
                        </span>
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-3.5 w-3.5" />
                        {r.daily_km_limit == null ? (
                          dict.rental.unlimitedKm
                        ) : (
                          <>
                            <span dir="ltr" className="tabular-nums">
                              {r.daily_km_limit}
                            </span>{" "}
                            {dict.rental.kmPerDay}
                          </>
                        )}
                      </span>
                      {r.insurance_included && (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-success" />
                          {dict.rental.insuranceIncluded}
                        </span>
                      )}
                    </p>
                    <a
                      href={`tel:${r.phone}`}
                      className="relative mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span dir="ltr" className="tabular-nums">
                        {r.phone}
                      </span>
                    </a>
                    {r.deposit_amount > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {t.deposit}{" "}
                          <span dir="ltr" className="tabular-nums">
                            {formatUsd(r.deposit_amount, { cents: true })}
                          </span>
                        </span>{" "}
                        — {t.depositNote}
                      </p>
                    )}
                    {r.notes && (
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {r.notes}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <RentalStatusControl
                      rentalId={r.id}
                      status={r.status}
                      labels={statusLabels}
                      errorLabel={dict.common.actionFailed}
                    />
                  </div>
                </div>
              </CardRow>
            ))}
          </CardList>
        ) : (
          <NextStepEmpty
            lang={lang}
            dict={dict}
            storeId={storeId}
            module="rentals"
            title={t.empty}
            className="mt-8"
          />
        )}
      </Container>
    </div>
  );
}
