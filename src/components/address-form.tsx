"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const labelClass = "text-sm font-semibold";

export type AddressValue = {
  region: string;
  city: string;
  street: string;
  building: string;
  floor: string;
  details: string;
  phone: string;
};

export function AddressForm({
  lang,
  dict,
  initial,
}: {
  lang: Locale;
  dict: Dictionary;
  initial: AddressValue;
}) {
  const router = useRouter();
  const t = dict.account.address;
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { error: saveError } = await supabase.from("addresses").upsert(
      {
        user_id: user.id,
        region: String(form.get("region")) || null,
        city: String(form.get("city")) || null,
        street: String(form.get("street")) || null,
        building: String(form.get("building")) || null,
        floor: String(form.get("floor")) || null,
        details: String(form.get("details")) || null,
        phone: String(form.get("phone")) || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (saveError) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    setLoading(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-bold">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="region">
            {t.region}
          </label>
          <select id="region" name="region" defaultValue={initial.region} className={fieldClass}>
            <option value="">{t.selectRegion}</option>
            {regions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name[lang]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="city">
            {t.city}
          </label>
          <input id="city" name="city" type="text" defaultValue={initial.city} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="street">
            {t.street}
          </label>
          <input id="street" name="street" type="text" defaultValue={initial.street} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="building">
            {t.building}
          </label>
          <input id="building" name="building" type="text" defaultValue={initial.building} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="floor">
            {t.floor}
          </label>
          <input id="floor" name="floor" type="text" defaultValue={initial.floor} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">
            {t.phone}
          </label>
          <input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={initial.phone} placeholder="+961 …" className={fieldClass} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="details">
          {t.details}
        </label>
        <textarea id="details" name="details" rows={2} defaultValue={initial.details} placeholder={t.detailsPlaceholder} className={fieldClass} />
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
          <span className="text-sm font-semibold text-primary">
            {dict.account.saved}
          </span>
        )}
        {error && (
          <span className="text-sm font-semibold text-red-600">{error}</span>
        )}
      </div>
    </form>
  );
}
