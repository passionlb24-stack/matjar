"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";
import { WHOLESALE_CATEGORIES } from "@/lib/wholesale";
import { ImageUpload } from "@/components/image-upload";

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const label = "text-sm font-semibold";

type TierRow = { qty: string; price: string };

export function WholesaleForm({
  lang,
  dict,
  sellerName,
}: {
  lang: Locale;
  dict: Dictionary;
  sellerName: string;
}) {
  const router = useRouter();
  const t = dict.wholesale;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);

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
    const moqRaw = String(form.get("moq") ?? "").trim();
    const cleanTiers = tiers
      .filter((x) => x.qty.trim() && x.price.trim())
      .map((x) => ({ qty: Number(x.qty), price: Number(x.price) }));
    const { data, error: insErr } = await supabase
      .from("wholesale_products")
      .insert({
        seller_id: user.id,
        seller_name: sellerName || null,
        title: String(form.get("title")),
        description: String(form.get("description")),
        category: String(form.get("category")) || null,
        unit: String(form.get("unit")) || null,
        moq: moqRaw === "" ? null : Number(moqRaw),
        price: priceRaw === "" ? null : Number(priceRaw),
        tiers: cleanTiers,
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
    router.push(`/${lang}/wholesale/${data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <ImageUpload folder="wholesale" value={imageUrl} onChange={setImageUrl} label={t.image} />

      <div>
        <label className={label} htmlFor="title">{t.productTitle}</label>
        <input id="title" name="title" type="text" required placeholder={t.productTitlePlaceholder} className={field} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="category">{t.category}</label>
          <select id="category" name="category" defaultValue="" className={field}>
            <option value="">{t.selectCategory}</option>
            {WHOLESALE_CATEGORIES.map((c) => (
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
          <label className={label} htmlFor="unit">{t.unit}</label>
          <input id="unit" name="unit" type="text" placeholder={t.unitPlaceholder} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="moq">{t.moq}</label>
          <input id="moq" name="moq" type="number" min="1" step="1" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="price">{t.basePrice}</label>
          <input id="price" name="price" type="number" min="0" step="0.01" className={field} placeholder="$" />
        </div>
      </div>

      {/* Tiered pricing */}
      <div className="rounded-xl border border-border/70 p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className={label}>{t.tiers}</span>
            <p className="text-xs text-muted-foreground">{t.tiersHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setTiers([...tiers, { qty: "", price: "" }])}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-surface-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.addTier}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {tiers.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={row.qty}
                onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                type="number" min="1" step="1" placeholder={t.tierQty}
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={row.price}
                onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                type="number" min="0" step="0.01" placeholder={t.tierPrice}
                className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                aria-label={t.remove}
                className="flex w-9 shrink-0 items-center justify-center rounded-lg border border-border text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className={label} htmlFor="description">{t.description}</label>
        <textarea id="description" name="description" rows={4} required placeholder={t.descriptionPlaceholder} className={field} />
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
