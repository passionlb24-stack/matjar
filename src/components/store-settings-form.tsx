"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const labelClass = "text-sm font-semibold";

export type StoreSettings = {
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  min_order: string;
  prep_time: string;
  payment_note: string;
  specialties: string;
  insurance: string;
  lat: string;
  lng: string;
};

export function StoreSettingsForm({
  storeId,
  dict,
  initial,
  isHealthcare = false,
}: {
  storeId: string;
  dict: Dictionary;
  initial: StoreSettings;
  isHealthcare?: boolean;
}) {
  const router = useRouter();
  const t = dict.merchant.settings;
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState(initial.accepts_delivery);
  const [pickup, setPickup] = useState(initial.accepts_pickup);
  const [lat, setLat] = useState(initial.lat);
  const [lng, setLng] = useState(initial.lng);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError(t.locationError);
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setGeoError(t.locationError);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    setError(null);
    const form = new FormData(e.currentTarget);
    const minRaw = String(form.get("min_order") ?? "").trim();
    const { error: saveError } = await createClient()
      .from("stores")
      .update({
        accepts_delivery: delivery,
        accepts_pickup: pickup,
        min_order: minRaw === "" ? null : Number(minRaw),
        prep_time: String(form.get("prep_time")) || null,
        payment_note: String(form.get("payment_note")) || null,
        specialties: String(form.get("specialties") ?? "") || null,
        insurance: String(form.get("insurance") ?? "") || null,
        lat: lat.trim() === "" ? null : Number(lat),
        lng: lng.trim() === "" ? null : Number(lng),
        updated_at: new Date().toISOString(),
      })
      .eq("id", storeId);
    if (saveError) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    setLoading(false);
    setSaved(true);
    router.refresh();
  }

  const toggle = (on: boolean) =>
    `flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
      on
        ? "border-primary bg-primary-soft text-primary"
        : "border-border text-muted-foreground"
    }`;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <div>
        <span className={labelClass}>{t.fulfillment}</span>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <label className={toggle(delivery)}>
            <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} className="h-4 w-4 accent-primary" />
            {t.delivery}
          </label>
          <label className={toggle(pickup)}>
            <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="h-4 w-4 accent-primary" />
            {t.pickup}
          </label>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="min_order">{t.minOrder}</label>
        <input id="min_order" name="min_order" type="number" min="0" step="0.01" defaultValue={initial.min_order} placeholder="0" className={fieldClass} />
        <p className="mt-1 text-xs text-muted-foreground">{t.minOrderHint}</p>
      </div>

      <div>
        <label className={labelClass} htmlFor="prep_time">{t.prepTime}</label>
        <input id="prep_time" name="prep_time" type="text" defaultValue={initial.prep_time} placeholder={t.prepTimePlaceholder} className={fieldClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="payment_note">{t.paymentNote}</label>
        <input id="payment_note" name="payment_note" type="text" defaultValue={initial.payment_note} placeholder={t.paymentNotePlaceholder} className={fieldClass} />
      </div>

      {isHealthcare && (
        <>
          <div>
            <label className={labelClass} htmlFor="specialties">{t.specialties}</label>
            <input id="specialties" name="specialties" type="text" defaultValue={initial.specialties} placeholder={t.specialtiesPlaceholder} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="insurance">{t.insurance}</label>
            <input id="insurance" name="insurance" type="text" defaultValue={initial.insurance} placeholder={t.insurancePlaceholder} className={fieldClass} />
          </div>
        </>
      )}

      <div>
        <span className={labelClass}>{t.location}</span>
        <p className="text-xs text-muted-foreground">{t.locationHint}</p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {locating ? t.locating : t.useMyLocation}
        </button>
        {geoError && (
          <p className="mt-1 text-sm font-medium text-red-600">{geoError}</p>
        )}
        {lat && lng && !geoError && (
          <p className="mt-1 text-sm font-semibold text-primary">
            {t.locationSet}
          </p>
        )}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="lat">
              {t.lat}
            </label>
            <input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lng">
              {t.lng}
            </label>
            <input id="lng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} className={fieldClass} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {loading ? dict.account.saving : dict.account.save}
        </button>
        {saved && (
          <span className="text-sm font-semibold text-primary">{dict.account.saved}</span>
        )}
        {error && (
          <span className="text-sm font-semibold text-red-600">{error}</span>
        )}
      </div>
    </form>
  );
}
