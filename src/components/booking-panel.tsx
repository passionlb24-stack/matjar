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
import { categoryIcons } from "@/components/category-icon";

type Service = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  attributes?: Record<string, string> | null;
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
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  category: CategoryKey;
  services: Service[];
  customerName: string | null;
  whatsapp?: string | null;
  storeName?: string;
}) {
  const router = useRouter();
  const Icon = categoryIcons[category];
  const style = categoryStyles[category];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedWaUrl, setBookedWaUrl] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

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
    const { error: bookingError } = await supabase.from("bookings").insert({
      store_id: storeId,
      customer_id: user.id,
      product_id: serviceId || null,
      service_name: service?.name ?? null,
      requested_date: String(form.get("date")) || null,
      requested_time: String(form.get("time")) || null,
      customer_name: customerName,
      notes: String(form.get("notes")) || null,
    });
    if (bookingError) {
      setError(dict.auth.errorGeneric);
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
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
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

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4"
          >
            {s.imageUrl ? (
              <Image src={s.imageUrl} alt={s.name} width={64} height={64} className="h-16 w-16 shrink-0 rounded-xl object-cover" sizes="64px" />
            ) : (
              <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.cover}`}>
                <Icon className="h-7 w-7 text-black/20" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-bold">{s.name}</h3>
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

      <div className="mt-8">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <CalendarCheck className="h-5 w-5 text-primary" />
          {dict.booking.title}
        </h3>
        {customerName ? (
          <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
            <div>
              <label className={labelClass} htmlFor="service_id">
                {dict.booking.selectService}
              </label>
              <select id="service_id" name="service_id" required defaultValue="" className={fieldClass}>
                <option value="" disabled>
                  {dict.booking.selectService}
                </option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="date">
                  {dict.booking.date}
                </label>
                <input id="date" name="date" type="date" required className={fieldClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="time">
                  {dict.booking.time}
                </label>
                <input id="time" name="time" type="time" className={fieldClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="notes">
                {dict.booking.notes}
              </label>
              <textarea id="notes" name="notes" rows={2} placeholder={dict.booking.notesPlaceholder} className={fieldClass} />
            </div>
            {error && (
              <p className="text-sm font-medium text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {loading ? dict.booking.submitting : dict.booking.submit}
            </button>
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
