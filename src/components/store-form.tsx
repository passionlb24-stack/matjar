"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

type Option = { value: string; label: string };

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const label = "text-sm font-semibold";

export function StoreForm({
  lang,
  dict,
  businessTypes,
  regions,
}: {
  lang: Locale;
  dict: Dictionary;
  businessTypes: Option[];
  regions: Option[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.push(`/${lang}/login`);
      return;
    }
    // Field-level checks with clear messages so the merchant knows exactly what
    // to fix (not just a browser tooltip).
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      setError(dict.merchant.storeNameRequired);
      setLoading(false);
      return;
    }
    const businessType = String(form.get("business_type_id") ?? "");
    if (!businessType) {
      setError(dict.merchant.businessTypeRequired);
      setLoading(false);
      return;
    }
    const { data: created, error } = await supabase
      .from("stores")
      .insert({
        owner_id: user.id,
        name,
        business_type_id: businessType,
        region: String(form.get("region")) || null,
        area: String(form.get("area")) || null,
        phone: String(form.get("phone")) || null,
        whatsapp: String(form.get("whatsapp")) || null,
        description: String(form.get("description")) || null,
      })
      .select("id")
      .single();
    if (error || !created?.id) {
      // Map the common failures to a clear message; fall back to the raw reason.
      setError(
        error?.code === "23505"
          ? dict.merchant.storeNameTaken
          : error?.message
            ? `${dict.merchant.createFailed} (${error.message})`
            : dict.auth.errorGeneric,
      );
      setLoading(false);
      return;
    }
    router.push(`/${lang}/merchant`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <div>
        <label className={label} htmlFor="name">
          {dict.merchant.storeName}
        </label>
        <input id="name" name="name" type="text" required placeholder={dict.merchant.storeNamePlaceholder} className={field} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="business_type_id">
            {dict.merchant.businessType}
          </label>
          <select id="business_type_id" name="business_type_id" required defaultValue="" className={field}>
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
          <label className={label} htmlFor="region">
            {dict.merchant.region}
          </label>
          <select id="region" name="region" defaultValue="" className={field}>
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
        <label className={label} htmlFor="area">
          {dict.merchant.area}
        </label>
        <input id="area" name="area" type="text" placeholder={dict.merchant.areaPlaceholder} className={field} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="phone">
            {dict.merchant.phone}
          </label>
          <input id="phone" name="phone" type="tel" inputMode="tel" placeholder="+961 …" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="whatsapp">
            {dict.merchant.whatsapp}
          </label>
          <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" placeholder="+961 …" className={field} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="description">
          {dict.merchant.description}
        </label>
        <textarea id="description" name="description" rows={3} placeholder={dict.merchant.descriptionPlaceholder} className={field} />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? dict.merchant.creating : dict.merchant.create}
      </button>
    </form>
  );
}
