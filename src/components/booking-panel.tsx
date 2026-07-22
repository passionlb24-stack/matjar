"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { categoryStyles, type CategoryKey } from "@/lib/catalog";
import { attributeSummary } from "@/lib/attributes";
import { waLink } from "@/lib/whatsapp";
import { daySpan, generateSlots, type WeekHours } from "@/lib/hours";
import { localized } from "@/lib/i18n-field";
import { groupBySection, type SectionInfo } from "@/lib/sections";
import { categoryIcons } from "@/components/category-icon";

type Service = {
  id: string;
  name: string;
  nameEn?: string | null;
  price: number;
  imageUrl?: string | null;
  attributes?: Record<string, string> | null;
  sectionId?: string | null;
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const labelClass = "text-sm font-semibold";

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

export function BookingPanel({
  storeId,
  lang,
  dict,
  category,
  services,
  customerName,
  whatsapp = null,
  storeName = "",
  hours = null,
  slotMinutes = 30,
  doctors = [],
  sections = [],
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  category: CategoryKey;
  services: Service[];
  customerName: string | null;
  whatsapp?: string | null;
  storeName?: string;
  hours?: WeekHours | null;
  slotMinutes?: number;
  doctors?: { id: string; name: string }[];
  sections?: SectionInfo[];
}) {
  const router = useRouter();
  const Icon = categoryIcons[category];
  const style = categoryStyles[category];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedWaUrl, setBookedWaUrl] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  // Conflict awareness: taken time strings for the picked date.
  const [taken, setTaken] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [pickedDate, setPickedDate] = useState("");
  // Availability is scoped to the chosen service (a different service at the
  // same time is fine — different provider/room), so we track the selection.
  const [serviceId, setServiceId] = useState("");
  // Multi-doctor clinics: availability is per doctor, so bookings for different
  // doctors don't block each other. Defaults to the first (server-ordered).
  const [doctorId, setDoctorId] = useState<string>(doctors[0]?.id ?? "");
  const today = new Date().toISOString().slice(0, 10);
  // Prefill the name only when the account actually has a real name — never the
  // email, so a booking is never recorded under an email address.
  const prefillName =
    customerName && !customerName.includes("@") ? customerName : "";

  // Fresha-style slot grid when the merchant configured structured hours;
  // otherwise fall back to a free time input + taken-times chips.
  const span = pickedDate
    ? daySpan(hours, new Date(`${pickedDate}T00:00:00`))
    : null;
  const slots =
    hours && span ? generateSlots(span, slotMinutes) : null;
  const dayClosed = !!hours && !!pickedDate && !span;

  async function refreshTaken(date: string, doctor: string, service: string) {
    // Nothing to conflict against until a service (or a doctor) is chosen.
    if (!date || (!doctor && !service)) {
      setTaken([]);
      return;
    }
    const { data } = await createClient().rpc("booked_times", {
      p_store_id: storeId,
      p_date: date,
      p_doctor_id: doctor || null,
      p_product_id: service || null,
    });
    setTaken(((data as string[] | null) ?? []).sort());
  }

  async function onDateChange(date: string) {
    setError(null);
    setPickedDate(date);
    setTime("");
    await refreshTaken(date, doctorId, serviceId);
  }

  async function onDoctorChange(doctor: string) {
    setDoctorId(doctor);
    setTime("");
    await refreshTaken(pickedDate, doctor, serviceId);
  }

  async function onServiceChange(service: string) {
    setServiceId(service);
    setTime("");
    await refreshTaken(pickedDate, doctorId, service);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.push(`/${lang}/login`);
      return;
    }
    const serviceId = String(form.get("service_id"));
    const service = services.find((s) => s.id === serviceId);
    // Re-check the slot right before inserting (someone may have taken it
    // while the form was open).
    const chosenDate = String(form.get("date")) || "";
    const chosenTime = String(form.get("time")) || "";
    if (chosenDate && chosenTime) {
      const { data: freshTaken } = await supabase.rpc("booked_times", {
        p_store_id: storeId,
        p_date: chosenDate,
        p_doctor_id: doctorId || null,
        p_product_id: serviceId || null,
      });
      if (((freshTaken as string[] | null) ?? []).includes(chosenTime)) {
        setTaken(((freshTaken as string[] | null) ?? []).sort());
        setError(dict.booking.slotTaken);
        setLoading(false);
        return;
      }
    }
    const { error: bookingError } = await supabase.from("bookings").insert({
      store_id: storeId,
      customer_id: user.id,
      product_id: serviceId || null,
      service_name: service?.name ?? null,
      doctor_id: doctorId || null,
      requested_date: String(form.get("date")) || null,
      requested_time: String(form.get("time")) || null,
      customer_name: String(form.get("customer_name")).trim() || customerName,
      notes: String(form.get("notes")) || null,
    });
    if (bookingError) {
      // 23505 = the DB slot-conflict unique index fired (someone grabbed the
      // slot in the race window). Show the friendly "slot taken" message.
      if (bookingError.code === "23505") {
        await refreshTaken(chosenDate, doctorId, serviceId);
        setError(dict.booking.slotTaken);
      } else {
        setError(dict.auth.errorGeneric);
      }
      setLoading(false);
      return;
    }
    // Pre-build a WhatsApp message so the customer can notify the clinic
    // instantly instead of relying on the merchant checking the dashboard.
    if (whatsapp) {
      const date = String(form.get("date")) || "";
      const time = String(form.get("time")) || "";
      const notes = String(form.get("notes")) || "";
      const msg = [
        `${dict.booking.waGreeting} ${storeName}`.trim(),
        service?.name ? `• ${service.name}` : "",
        [date, time].filter(Boolean).join(" "),
        notes,
      ]
        .filter(Boolean)
        .join("\n");
      setBookedWaUrl(waLink(whatsapp, msg));
    }
    setLoading(false);
    setBooked(true);
    router.refresh();
  }

  if (booked) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success-soft p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-lg font-extrabold">
          {dict.booking.bookedTitle}
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {dict.booking.bookedNote}
        </p>
        <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          {bookedWaUrl && (
            <a
              href={bookedWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              {dict.booking.notifyMerchantWa}
            </a>
          )}
          <Link
            href={`/${lang}/bookings`}
            className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
          >
            {dict.booking.viewMyBookings}
          </Link>
        </div>
      </div>
    );
  }

  // A section's services (or the whole flat list) rendered with the same card.
  function renderServices(list: Service[]) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {list.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4"
          >
            {s.imageUrl ? (
              <Image src={s.imageUrl} alt={localized(s.name, s.nameEn, lang)} width={64} height={64} className="h-16 w-16 shrink-0 rounded-xl object-cover" sizes="64px" />
            ) : (
              <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.cover}`}>
                <Icon className="h-7 w-7 text-black/20" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-bold">{localized(s.name, s.nameEn, lang)}</h3>
              {attributeSummary(category, s.attributes, lang) && (
                <p className="truncate text-xs text-muted-foreground">
                  {attributeSummary(category, s.attributes, lang)}
                </p>
              )}
              <p className="mt-0.5 text-sm font-bold">{formatPrice(s.price)}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Group into service groups when defined; else one flat list (no regression).
  const groups = groupBySection(services, sections);

  return (
    <div>
      {sections.length > 0 ? (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.section?.id ?? "__other"}>
              <h3 className="mb-4 text-lg font-bold">
                {g.section
                  ? localized(g.section.name, g.section.nameEn, lang)
                  : dict.store.otherSection}
              </h3>
              {renderServices(g.items)}
            </section>
          ))}
        </div>
      ) : (
        renderServices(services)
      )}

      <div className="mt-8">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <CalendarCheck className="h-5 w-5 text-primary" />
          {dict.booking.title}
        </h3>
        {customerName ? (
          <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
            <div>
              <label className={labelClass} htmlFor="customer_name">
                {dict.booking.yourName}
              </label>
              <input
                id="customer_name"
                name="customer_name"
                type="text"
                required
                defaultValue={prefillName}
                placeholder={dict.booking.yourNamePlaceholder}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="service_id">
                {dict.booking.selectService}
              </label>
              <select
                id="service_id"
                name="service_id"
                required
                value={serviceId}
                onChange={(e) => onServiceChange(e.target.value)}
                className={fieldClass}
              >
                <option value="" disabled>
                  {dict.booking.selectService}
                </option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {localized(s.name, s.nameEn, lang)}
                  </option>
                ))}
              </select>
            </div>
            {doctors.length > 0 && (
              <div>
                <label className={labelClass} htmlFor="doctor_id">
                  {dict.booking.selectDoctor}
                </label>
                <select
                  id="doctor_id"
                  value={doctorId}
                  onChange={(e) => onDoctorChange(e.target.value)}
                  className={fieldClass}
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="date">
                  {dict.booking.date}
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  required
                  min={today}
                  onChange={(e) => onDateChange(e.target.value)}
                  className={fieldClass}
                />
              </div>
              {!hours && (
                <div>
                  <label className={labelClass} htmlFor="time">
                    {dict.booking.time}
                  </label>
                  <input
                    id="time"
                    name="time"
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              )}
            </div>
            {hours && <input type="hidden" name="time" value={time} />}
            {hours && pickedDate && (
              <div>
                <span className={labelClass}>{dict.booking.pickSlot}</span>
                {dayClosed ? (
                  <p className="mt-2 rounded-xl bg-surface-muted p-3 text-sm font-semibold text-muted-foreground">
                    {dict.booking.noSlots}
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {(slots ?? []).map((s) => {
                      const isTaken = taken.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={isTaken}
                          onClick={() => setTime(s)}
                          dir="ltr"
                          className={`rounded-xl border px-2 py-2 text-sm font-bold tabular-nums transition-colors ${
                            isTaken
                              ? "cursor-not-allowed border-border bg-surface-muted text-muted-foreground line-through opacity-60"
                              : time === s
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary/50"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {!hours && taken.length > 0 && (
              <div className="rounded-xl bg-warning-soft p-3">
                <p className="text-xs font-bold text-warning">
                  {dict.booking.takenTimes}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {taken.map((tt) => (
                    <span
                      key={tt}
                      dir="ltr"
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        tt === time
                          ? "bg-red-500 text-white"
                          : "bg-warning-soft text-warning"
                      }`}
                    >
                      {tt}
                    </span>
                  ))}
                </div>
                {time && taken.includes(time) && (
                  <p className="mt-1.5 text-xs font-bold text-danger">
                    {dict.booking.slotTaken}
                  </p>
                )}
              </div>
            )}
            <div>
              <label className={labelClass} htmlFor="notes">
                {dict.booking.notes}
              </label>
              <textarea id="notes" name="notes" rows={2} placeholder={dict.booking.notesPlaceholder} className={fieldClass} />
            </div>
            {error && (
              <p className="text-sm font-medium text-danger">{error}</p>
            )}
            <button
              type="submit"
              disabled={
                loading ||
                (!!time && taken.includes(time)) ||
                (!!hours && !time)
              }
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {loading ? dict.booking.submitting : dict.booking.submit}
            </button>
            <p className="text-xs text-muted-foreground">
              {dict.booking.payOnArrival}
            </p>
          </form>
        ) : (
          <Link
            href={`/${lang}/login`}
            className="inline-block rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {dict.booking.loginToBook}
          </Link>
        )}
      </div>
    </div>
  );
}
