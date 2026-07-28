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
  // Booking engine v2 (0174): how this service is delivered.
  allocationMode?: string | null;
  durationMinutes?: number | null;
  bufferMinutes?: number | null;
  capacityPerSlot?: number | null;
};

type BusyRange = { s: string; e: string };
type Avail = {
  mode: string | null;
  duration: number;
  buffer: number;
  capacity: number | null;
  busy: BusyRange[];
  busy_by_provider: Record<string, BusyRange[]>;
  windows: { s: string; e: string }[] | null;
  blocked: boolean;
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
  customerPhone = null,
  whatsapp = null,
  storeName = "",
  hours = null,
  slotMinutes = 30,
  doctors = [],
  providerServices = {},
  sections = [],
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  category: CategoryKey;
  services: Service[];
  customerName: string | null;
  customerPhone?: string | null;
  whatsapp?: string | null;
  storeName?: string;
  hours?: WeekHours | null;
  slotMinutes?: number;
  doctors?: { id: string; name: string; specialty?: string | null }[];
  /** productId -> provider ids that offer it. Absent/empty = any provider. */
  providerServices?: Record<string, string[]>;
  sections?: SectionInfo[];
}) {
  const router = useRouter();
  const Icon = categoryIcons[category];
  const style = categoryStyles[category];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedWaUrl, setBookedWaUrl] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  // Conflict awareness: taken time strings for the picked date (legacy path).
  const [taken, setTaken] = useState<string[]>([]);
  // New-engine availability (mode/duration/busy ranges/windows) — 0174.
  const [avail, setAvail] = useState<Avail | null>(null);
  const [time, setTime] = useState("");
  const [pickedDate, setPickedDate] = useState("");
  // Availability is scoped to the chosen service (a different service at the
  // same time is fine — different provider/room), so we track the selection.
  const [serviceId, setServiceId] = useState("");
  // Coupon (validated against the chosen service price; discount is honored on
  // arrival — there's no online payment).
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  // Multi-doctor clinics: availability is per doctor, so bookings for different
  // doctors don't block each other. Defaults to the first (server-ordered).
  const [doctorId, setDoctorId] = useState<string>(doctors[0]?.id ?? "");
  // Waitlist: when the chosen day is fully booked, let the customer get in line.
  const [waitBusy, setWaitBusy] = useState(false);
  const [waitJoined, setWaitJoined] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  // Prefill the name only when the account actually has a real name — never the
  // email, so a booking is never recorded under an email address.
  const prefillName =
    customerName && !customerName.includes("@") ? customerName : "";
  // Contact number so the merchant can reach the customer about the booking.
  const [phone, setPhone] = useState(customerPhone ?? "");

  // A provider can deliver a service if it's unassigned or explicitly linked.
  const offeredBy = (svcId: string, doctor: string) => {
    const assigned = providerServices[svcId];
    return (
      !assigned ||
      assigned.length === 0 ||
      (!!doctor && assigned.includes(doctor))
    );
  };
  // Services shown in the picker are limited to what the chosen provider offers
  // ("any available" imposes no filter — the engine assigns at placement).
  const visibleServices =
    doctorId && doctorId !== "any"
      ? services.filter((s) => offeredBy(s.id, doctorId))
      : services;

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const engineMode = selectedService?.allocationMode ?? null;
  // Providers grouped by specialty/department for the picker.
  const doctorGroups = doctors.reduce<
    Record<string, typeof doctors>
  >((acc, d) => {
    const key = d.specialty?.trim() || "";
    (acc[key] ??= []).push(d);
    return acc;
  }, {});

  // Fresha-style slot grid when the merchant configured structured hours;
  // otherwise fall back to a free time input + taken-times chips. The step is
  // the SERVICE's real duration (+buffer) on the new engine.
  const span = pickedDate
    ? daySpan(hours, new Date(`${pickedDate}T00:00:00`))
    : null;
  const engineStep =
    avail && avail.mode ? avail.duration + avail.buffer : slotMinutes;
  const slots = hours && span ? generateSlots(span, engineStep) : null;
  const dayClosed = (!!hours && !!pickedDate && !span) || !!avail?.blocked;

  // No booking a time that has already passed today (Asia/Beirut, so it's
  // correct whatever timezone the customer's device is in). The DB trigger is
  // the hard guard; this just hides past slots so they can't be picked.
  /* eslint-disable-next-line react-hooks/purity */
  const nowRef = new Date();
  const todayBeirut = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
  }).format(nowRef);
  const nowBeirut = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(nowRef);
  const isPastSlot = (slot: string) =>
    pickedDate === todayBeirut && slot <= nowBeirut;

  async function joinWaitlist() {
    if (waitBusy || !serviceId || !pickedDate) return;
    setWaitBusy(true);
    const { data, error: err } = await createClient().rpc(
      "join_booking_waitlist",
      {
        p_store_id: storeId,
        p_product_id: serviceId,
        p_date: pickedDate,
        p_doctor_id: doctorId && doctorId !== "any" ? doctorId : null,
        p_customer_name: prefillName || null,
        p_phone: null,
      },
    );
    setWaitBusy(false);
    const res = data as { ok: boolean; code?: string } | null;
    if (err || !res?.ok) {
      setError(
        res?.code === "already_waiting"
          ? dict.booking.waitlist.already
          : dict.auth.errorGeneric,
      );
      return;
    }
    setWaitJoined(true);
  }

  function addMinutes(hhmm: string, mins: number) {
    const [h, m] = hhmm.split(":").map(Number);
    const t = h * 60 + m + mins;
    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
  function rangesOverlap(r: BusyRange, a: number, b: number) {
    const s = new Date(r.s).getTime();
    const e = new Date(r.e).getTime();
    return s < b && e > a;
  }
  // Per-slot verdict under the selected service's allocation mode.
  function slotState(slot: string): { blocked: boolean; remaining?: number } {
    if (isPastSlot(slot)) return { blocked: true };
    if (!engineMode || !avail) return { blocked: taken.includes(slot) };
    if (avail.blocked) return { blocked: true };
    const a = new Date(`${pickedDate}T${slot}:00`).getTime();
    const b = a + (avail.duration + avail.buffer) * 60000;
    if (avail.windows) {
      const end = addMinutes(slot, avail.duration);
      const fits = avail.windows.some(
        (w) => slot >= w.s.slice(0, 5) && end <= w.e.slice(0, 5),
      );
      if (!fits) return { blocked: true };
    }
    if (engineMode === "request_based") return { blocked: false };
    if (engineMode === "capacity_based") {
      const used = avail.busy.filter((r) => rangesOverlap(r, a, b)).length;
      const cap = avail.capacity ?? 1;
      return { blocked: used >= cap, remaining: Math.max(0, cap - used) };
    }
    if (engineMode === "pooled_providers" && doctorId === "any") {
      const lists = Object.values(avail.busy_by_provider ?? {});
      if (lists.length === 0) return { blocked: true };
      const someoneFree = lists.some(
        (rs) => !rs.some((r) => rangesOverlap(r, a, b)),
      );
      return { blocked: !someoneFree };
    }
    return { blocked: avail.busy.some((r) => rangesOverlap(r, a, b)) };
  }

  // The whole chosen day is unavailable: either the merchant is closed, or
  // every generated slot is blocked. request_based never counts as full
  // (it's a request, not a fixed seat).
  const dayFull =
    !!hours &&
    !!pickedDate &&
    !!serviceId &&
    engineMode !== "request_based" &&
    (dayClosed ||
      (!!slots && slots.length > 0 && slots.every((s) => slotState(s).blocked)));

  async function refreshTaken(date: string, doctor: string, service: string) {
    // Nothing to conflict against until a service (or a doctor) is chosen.
    if (!date || (!doctor && !service)) {
      setTaken([]);
      setAvail(null);
      return;
    }
    // New engine (service declares an allocation mode): one RPC returns mode,
    // real duration, blocking ranges and provider windows.
    const svcMode =
      services.find((s) => s.id === service)?.allocationMode ?? null;
    if (service && svcMode) {
      const { data } = await createClient().rpc("get_booking_busy", {
        p_store_id: storeId,
        p_product_id: service,
        p_date: date,
        p_doctor_id: doctor && doctor !== "any" ? doctor : null,
        p_any: doctor === "any",
      });
      setAvail((data as Avail | null) ?? null);
      setTaken([]);
      return;
    }
    setAvail(null);
    const { data } = await createClient().rpc("booked_times", {
      p_store_id: storeId,
      p_date: date,
      p_doctor_id: doctor && doctor !== "any" ? doctor : null,
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
    // If the current service isn't offered by the new provider, clear it
    // ("any available" imposes no filter).
    let svc = serviceId;
    if (doctor !== "any" && svc && !offeredBy(svc, doctor)) {
      svc = "";
      setServiceId("");
    }
    await refreshTaken(pickedDate, doctor, svc);
  }

  async function onServiceChange(service: string) {
    setServiceId(service);
    setTime("");
    // The discount is tied to the service price — reset it when the service
    // changes so a stale discount can't carry over.
    setCoupon(null);
    setCouponError(null);
    // Pooled team services default to "any available" — the engine assigns.
    let doctor = doctorId;
    const mode = services.find((s) => s.id === service)?.allocationMode ?? null;
    if (mode === "pooled_providers" && doctors.length > 0) {
      doctor = "any";
      setDoctorId("any");
    } else if (doctorId === "any") {
      doctor = doctors[0]?.id ?? "";
      setDoctorId(doctor);
    }
    await refreshTaken(pickedDate, doctor, service);
  }

  const selectedPrice = services.find((s) => s.id === serviceId)?.price ?? 0;

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || !serviceId) return;
    setCouponBusy(true);
    setCouponError(null);
    const { data } = await createClient().rpc("validate_coupon", {
      p_store_id: storeId,
      p_code: code,
      p_subtotal: selectedPrice,
    });
    setCouponBusy(false);
    const row = (data as { valid: boolean; discount: number }[] | null)?.[0];
    if (row?.valid) {
      setCoupon({ code, discount: Number(row.discount) || 0 });
    } else {
      setCoupon(null);
      setCouponError(dict.booking.couponInvalid);
    }
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
    const chosenDate = String(form.get("date")) || "";
    const chosenTime = String(form.get("time")) || "";

    // Guard against a past time (e.g. slot picked, then time passed).
    if (chosenTime && isPastSlot(chosenTime)) {
      setError(dict.booking.pastSlot);
      setLoading(false);
      return;
    }

    // New engine: one atomic RPC computes the real range, assigns pooled
    // providers, checks hours/capacity, and the DB constraints win any race.
    if (service?.allocationMode) {
      const { data: res, error: rpcErr } = await supabase.rpc("place_booking", {
        p_store_id: storeId,
        p_product_id: serviceId,
        p_date: chosenDate,
        p_time: chosenTime,
        p_doctor_id: doctorId && doctorId !== "any" ? doctorId : null,
        p_any: doctorId === "any",
        p_customer_name:
          String(form.get("customer_name")).trim() || customerName,
        p_phone: phone.trim() || null,
        p_notes: String(form.get("notes")) || null,
        p_coupon: coupon?.code ?? null,
      });
      const r = res as { ok?: boolean; code?: string } | null;
      if (rpcErr || !r?.ok) {
        const code = r?.code ?? "";
        setError(
          rpcErr?.message?.includes("past_booking")
            ? dict.booking.pastSlot
            : code === "slot_taken"
            ? dict.booking.slotTaken
            : code === "capacity_full"
              ? dict.booking.capacityFull
              : code === "no_provider_free"
                ? dict.booking.noProviderFree
                : code === "outside_hours"
                  ? dict.booking.outsideHours
                  : dict.auth.errorGeneric,
        );
        if (code === "slot_taken" || code === "capacity_full") {
          await refreshTaken(chosenDate, doctorId, serviceId);
        }
        setLoading(false);
        return;
      }
    } else {
    // Legacy path — re-check the slot right before inserting (someone may
    // have taken it while the form was open).
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
      phone: phone.trim() || null,
      notes: String(form.get("notes")) || null,
      coupon_code: coupon?.code ?? null,
      discount: coupon?.discount ?? 0,
    });
    if (bookingError) {
      // 23505 = the DB slot-conflict unique index fired (someone grabbed the
      // slot in the race window). Show the friendly "slot taken" message.
      if (bookingError.code === "23505") {
        await refreshTaken(chosenDate, doctorId, serviceId);
        setError(dict.booking.slotTaken);
      } else if (bookingError.message?.includes("past_booking")) {
        setError(dict.booking.pastSlot);
      } else {
        setError(dict.auth.errorGeneric);
      }
      setLoading(false);
      return;
    }
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
              <label className={labelClass} htmlFor="customer_phone">
                {dict.booking.yourPhone}
              </label>
              <input
                id="customer_phone"
                name="customer_phone"
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+961 …"
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
                {visibleServices.map((s) => (
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
                  {engineMode === "pooled_providers" && (
                    <option value="any">{dict.booking.anyProvider}</option>
                  )}
                  {Object.entries(doctorGroups).map(([spec, docs]) =>
                    spec ? (
                      <optgroup key={spec} label={spec}>
                        {docs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      docs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))
                    ),
                  )}
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
            {engineMode && avail && (
              <p className="text-xs font-semibold text-muted-foreground">
                ⏱️ {dict.booking.durationLabel.replace("{n}", String(avail.duration))}
              </p>
            )}
            {engineMode === "request_based" && (
              <p className="rounded-xl bg-info-soft px-3 py-2 text-sm font-semibold text-info">
                {dict.booking.requestNote}
              </p>
            )}
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
                      const st = slotState(s);
                      const isTaken = st.blocked;
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
                          {st.remaining != null &&
                            st.remaining > 0 &&
                            avail?.capacity != null &&
                            st.remaining < avail.capacity && (
                              <span className="block text-[10px] font-semibold opacity-80">
                                {dict.booking.spotsLeft.replace(
                                  "{n}",
                                  String(st.remaining),
                                )}
                              </span>
                            )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {dayFull &&
              (waitJoined ? (
                <div className="rounded-xl bg-success-soft px-4 py-3 text-sm font-bold text-success">
                  {dict.booking.waitlist.joined}
                </div>
              ) : (
                <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
                  <p className="text-sm font-bold text-warning">
                    {dict.booking.waitlist.fullTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {dict.booking.waitlist.fullNote}
                  </p>
                  <button
                    type="button"
                    onClick={joinWaitlist}
                    disabled={waitBusy}
                    className="mt-2.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
                  >
                    {dict.booking.waitlist.join}
                  </button>
                </div>
              ))}
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

            {/* Coupon — validated against the selected service price. */}
            {serviceId && selectedPrice > 0 && (
              <div>
                <label className={labelClass}>{dict.booking.couponLabel}</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value);
                      setCoupon(null);
                      setCouponError(null);
                    }}
                    placeholder={dict.booking.couponPlaceholder}
                    className={fieldClass.replace("mt-1.5", "mt-0")}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponBusy || !couponInput.trim()}
                    className="shrink-0 rounded-xl border border-border px-4 text-sm font-bold transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                  >
                    {dict.booking.couponApply}
                  </button>
                </div>
                {couponError && (
                  <p className="mt-1.5 text-xs font-semibold text-danger">
                    {couponError}
                  </p>
                )}
                {coupon && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-success-soft px-3 py-2 text-sm font-bold text-success">
                    <span>
                      {dict.booking.discountLabel}: −{formatPrice(coupon.discount)}
                    </span>
                    <span className="text-foreground">
                      {dict.booking.netLabel}:{" "}
                      {formatPrice(Math.max(0, selectedPrice - coupon.discount))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm font-medium text-danger">{error}</p>
            )}
            <button
              type="submit"
              disabled={
                loading ||
                (!!time && slotState(time).blocked) ||
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
