"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ImageUpload } from "@/components/image-upload";

type Option = { value: string; label: string };

type Initial = {
  name: string;
  description: string | null;
  business_type_id: string | null;
  region: string | null;
  area: string | null;
  phone: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const labelClass = "text-sm font-semibold";

export function EditStoreForm({
  storeId,
  lang,
  dict,
  businessTypes,
  regions,
  initial,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  businessTypes: Option[];
  regions: Option[];
  initial: Initial;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(initial.logo_url);
  const [cover, setCover] = useState<string | null>(initial.cover_url);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase
      .from("stores")
      .update({
        name: String(form.get("name")),
        description: String(form.get("description")) || null,
        business_type_id: String(form.get("business_type_id")) || null,
        region: String(form.get("region")) || null,
        area: String(form.get("area")) || null,
        phone: String(form.get("phone")) || null,
        whatsapp: String(form.get("whatsapp")) || null,
        logo_url: logo,
        cover_url: cover,
      })
      .eq("id", storeId);
    if (error) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    router.push(`/${lang}/merchant/${storeId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUpload folder={storeId} value={logo} onChange={setLogo} label={dict.merchant.logo} />
        <ImageUpload folder={storeId} value={cover} onChange={setCover} label={dict.merchant.cover} />
      </div>

      <div>
        <label className={labelClass} htmlFor="name">
          {dict.merchant.storeName}
        </label>
        <input id="name" name="name" type="text" required defaultValue={initial.name} className={fieldClass} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="business_type_id">
            {dict.merchant.businessType}
          </label>
          <select id="business_type_id" name="business_type_id" required defaultValue={initial.business_type_id ?? ""} className={fieldClass}>
            <option value="" disabled>
              {dict.merchant.selectType}
            </option>
            {businessTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="region">
            {dict.merchant.region}
          </label>
          <select id="region" name="region" defaultValue={initial.region ?? ""} className={fieldClass}>
            <option value="" disabled>
              {dict.merchant.selectRegion}
            </option>
            {regions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="area">
          {dict.merchant.area}
        </label>
        <input id="area" name="area" type="text" defaultValue={initial.area ?? ""} placeholder={dict.merchant.areaPlaceholder} className={fieldClass} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="phone">
            {dict.merchant.phone}
          </label>
          <input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={initial.phone ?? ""} placeholder="+961 …" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="whatsapp">
            {dict.merchant.whatsapp}
          </label>
          <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" defaultValue={initial.whatsapp ?? ""} placeholder="+961 …" className={fieldClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="description">
          {dict.merchant.description}
        </label>
        <textarea id="description" name="description" rows={3} defaultValue={initial.description ?? ""} placeholder={dict.merchant.descriptionPlaceholder} className={fieldClass} />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? dict.merchant.saving : dict.merchant.save}
      </button>
    </form>
  );
}
