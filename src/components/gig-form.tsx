"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";
import { GIG_CATEGORIES } from "@/lib/gigs";
import { ImageUpload } from "@/components/image-upload";

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const label = "text-sm font-semibold";

export function GigForm({
  lang,
  dict,
  freelancerName,
}: {
  lang: Locale;
  dict: Dictionary;
  freelancerName: string;
}) {
  const router = useRouter();
  const t = dict.freelance;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

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
    const priceRaw = String(form.get("price") ?? "").trim();
    const daysRaw = String(form.get("delivery_days") ?? "").trim();
    const { data, error: insErr } = await supabase
      .from("gigs")
      .insert({
        freelancer_id: user.id,
        freelancer_name: freelancerName || null,
        title: String(form.get("title")),
        description: String(form.get("description")),
        category: String(form.get("category")) || null,
        price: priceRaw === "" ? null : Number(priceRaw),
        delivery_days: daysRaw === "" ? null : Number(daysRaw),
        region: String(form.get("region")) || null,
        image_url: imageUrl,
      })
      .select("id")
      .single();
    if (insErr || !data) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    router.push(`/${lang}/freelance/${data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <ImageUpload folder="gigs" value={imageUrl} onChange={setImageUrl} label={t.sample} />

      <div>
        <label className={label} htmlFor="title">{t.gigTitle}</label>
        <input id="title" name="title" type="text" required placeholder={t.gigTitlePlaceholder} className={field} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="category">{t.category}</label>
          <select id="category" name="category" defaultValue="" className={field}>
            <option value="">{t.selectCategory}</option>
            {GIG_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t.categories[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="region">{t.region}</label>
          <select id="region" name="region" defaultValue="" className={field}>
            <option value="">{t.selectRegion}</option>
            {regions.map((r) => (
              <option key={r.key} value={r.key}>{r.name[lang]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="price">{t.startingPrice}</label>
          <input id="price" name="price" type="number" min="0" step="0.01" className={field} placeholder="$" />
        </div>
        <div>
          <label className={label} htmlFor="delivery_days">{t.deliveryDays}</label>
          <input id="delivery_days" name="delivery_days" type="number" min="1" step="1" className={field} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="description">{t.description}</label>
        <textarea id="description" name="description" rows={5} required placeholder={t.descriptionPlaceholder} className={field} />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? dict.account.saving : t.publish}
      </button>
    </form>
  );
}
