"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [delivery, setDelivery] = useState(initial.accepts_delivery);
  const [pickup, setPickup] = useState(initial.accepts_pickup);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const minRaw = String(form.get("min_order") ?? "").trim();
    await createClient()
      .from("stores")
      .update({
        accepts_delivery: delivery,
        accepts_pickup: pickup,
        min_order: minRaw === "" ? null : Number(minRaw),
        prep_time: String(form.get("prep_time")) || null,
        payment_note: String(form.get("payment_note")) || null,
        specialties: String(form.get("specialties") ?? "") || null,
        insurance: String(form.get("insurance") ?? "") || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", storeId);
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
      </div>
    </form>
  );
}
