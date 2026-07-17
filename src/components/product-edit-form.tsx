"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Save, X, Trash2, Plus, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { CategoryKey } from "@/lib/catalog";
import { categoryAttributes } from "@/lib/attributes";
import { ImageUpload } from "@/components/image-upload";

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const label = "text-sm font-semibold";

// ISO timestamp → a datetime-local input value in the browser's local time.
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type VariantRow = { label: string; price: string; stock: string };
type OptionRow = { name: string; price: string };

export type ProductInitial = {
  name: string;
  nameEn: string;
  price: string;
  discountPrice: string;
  description: string;
  descriptionEn: string;
  imageUrl: string | null;
  gallery: string[];
  stock: string;
  dealToday: boolean;
  flashPrice: string;
  flashStart: string; // datetime-local value ("YYYY-MM-DDTHH:MM") or ""
  flashEnd: string;
  attributes: Record<string, string>;
  variants: VariantRow[];
  options: OptionRow[];
};

export function ProductEditForm({
  storeId,
  productId,
  lang,
  category,
  dict,
  simplified = false,
  initial,
}: {
  storeId: string;
  productId: string;
  lang: Locale;
  category: CategoryKey;
  dict: Dictionary;
  simplified?: boolean;
  initial: ProductInitial;
}) {
  const router = useRouter();
  const p = dict.merchant.products;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initial.imageUrl);
  const [gallery, setGallery] = useState<string[]>(initial.gallery);
  const [adderKey, setAdderKey] = useState(0);
  const [variants, setVariants] = useState<VariantRow[]>(initial.variants);
  const [options, setOptions] = useState<OptionRow[]>(initial.options);
  const [dealToday, setDealToday] = useState(initial.dealToday);
  const attrFields = categoryAttributes[category] ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const attributes: Record<string, string> = {};
    attrFields.forEach((f) => {
      const v = String(form.get(`attr_${f.key}`) ?? "").trim();
      if (v) attributes[f.key] = v;
    });
    const stockRaw = String(form.get("stock") ?? "").trim();

    // Flash sale: all three fields required together, else it's cleared.
    const flashPriceRaw = String(form.get("flash_price") ?? "").trim();
    const flashStartRaw = String(form.get("flash_start") ?? "").trim();
    const flashEndRaw = String(form.get("flash_end") ?? "").trim();
    const hasFlash =
      flashPriceRaw !== "" && flashStartRaw !== "" && flashEndRaw !== "";
    if (hasFlash && new Date(flashEndRaw) <= new Date(flashStartRaw)) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({
        name: String(form.get("name")),
        name_en: String(form.get("name_en") ?? "").trim() || null,
        price: Number(form.get("price")) || 0,
        discount_price: Number(form.get("discount_price")) || null,
        description: String(form.get("description")) || null,
        description_en: String(form.get("description_en") ?? "").trim() || null,
        image_url: imageUrl,
        gallery,
        stock: stockRaw === "" ? null : Number(stockRaw),
        deal_date: dealToday ? new Date().toISOString().slice(0, 10) : null,
        flash_price: hasFlash ? Number(flashPriceRaw) : null,
        flash_start: hasFlash ? new Date(flashStartRaw).toISOString() : null,
        flash_end: hasFlash ? new Date(flashEndRaw).toISOString() : null,
        attributes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (updateError) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }

    if (!simplified) {
      // Replace variants + options wholesale (order_items snapshot name/price,
      // so they don't reference these rows).
      await supabase.from("product_variants").delete().eq("product_id", productId);
      const cleanVariants = variants
        .filter((v) => v.label.trim())
        .map((v, i) => ({
          product_id: productId,
          label: v.label.trim(),
          price: v.price.trim() === "" ? null : Number(v.price),
          stock: v.stock.trim() === "" ? null : Number(v.stock),
          sort_order: i,
        }));
      if (cleanVariants.length)
        await supabase.from("product_variants").insert(cleanVariants);

      await supabase.from("product_options").delete().eq("product_id", productId);
      const cleanOptions = options
        .filter((o) => o.name.trim())
        .map((o, i) => ({
          product_id: productId,
          name: o.name.trim(),
          price: o.price.trim() === "" ? 0 : Number(o.price),
          sort_order: i,
        }));
      if (cleanOptions.length)
        await supabase.from("product_options").insert(cleanOptions);
    }

    router.push(`/${lang}/merchant/${storeId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-5"
    >
      <h2 className="text-lg font-bold">{p.editTitle}</h2>
      <ImageUpload folder={storeId} value={imageUrl} onChange={setImageUrl} label={p.image} />

      <div>
        <span className={label}>{p.gallery}</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {gallery.map((url, i) => (
            <div key={url} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
              <Image src={url} alt="" fill className="object-cover" sizes="80px" />
              <button
                type="button"
                onClick={() => setGallery(gallery.filter((_, j) => j !== i))}
                aria-label="remove"
                className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="w-20">
            <ImageUpload
              key={adderKey}
              folder={storeId}
              value={null}
              label=""
              onChange={(url) => {
                if (url) {
                  setGallery((g) => [...g, url]);
                  setAdderKey((k) => k + 1);
                }
              }}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="name">{p.name}</label>
        <input id="name" name="name" type="text" required defaultValue={initial.name} className={field} />
      </div>
      <div className={`grid gap-4 ${simplified ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <div>
          <label className={label} htmlFor="price">{p.price}</label>
          <input id="price" name="price" type="number" min="0" step="0.01" required defaultValue={initial.price} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="discount_price">{p.discountPrice}</label>
          <input id="discount_price" name="discount_price" type="number" min="0" step="0.01" defaultValue={initial.discountPrice} className={field} />
        </div>
        {!simplified && (
          <div>
            <label className={label} htmlFor="stock">{p.stock}</label>
            <input id="stock" name="stock" type="number" min="0" step="1" defaultValue={initial.stock} placeholder="∞" className={field} />
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/40 p-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={dealToday}
          onChange={(e) => setDealToday(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        {p.dealToday}
      </label>

      <div className="rounded-xl border border-amber-300/60 bg-amber-50/40 p-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-600" />
          <span className={label}>{dict.flash.merchantTitle}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {dict.flash.merchantHint}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={label} htmlFor="flash_price">
              {dict.flash.flashPrice}
            </label>
            <input id="flash_price" name="flash_price" type="number" min="0" step="0.01" defaultValue={initial.flashPrice} className={field} />
          </div>
          <div>
            <label className={label} htmlFor="flash_start">
              {dict.flash.flashStart}
            </label>
            <input id="flash_start" name="flash_start" type="datetime-local" defaultValue={toLocalInput(initial.flashStart)} className={field} />
          </div>
          <div>
            <label className={label} htmlFor="flash_end">
              {dict.flash.flashEnd}
            </label>
            <input id="flash_end" name="flash_end" type="datetime-local" defaultValue={toLocalInput(initial.flashEnd)} className={field} />
          </div>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="description">{p.description}</label>
        <textarea id="description" name="description" rows={2} defaultValue={initial.description} className={field} />
      </div>

      {/* Optional English overrides — shown to customers browsing in English. */}
      <div className="rounded-xl border border-border/70 p-4">
        <span className={label}>{p.englishOptional}</span>
        <div className="mt-3 space-y-3">
          <div>
            <label className={label} htmlFor="name_en">{p.nameEn}</label>
            <input id="name_en" name="name_en" type="text" defaultValue={initial.nameEn} className={field} />
          </div>
          <div>
            <label className={label} htmlFor="description_en">{p.descriptionEn}</label>
            <textarea id="description_en" name="description_en" rows={2} defaultValue={initial.descriptionEn} className={field} />
          </div>
        </div>
      </div>

      {attrFields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {attrFields.map((f) => (
            <div key={f.key}>
              <label className={label} htmlFor={`attr_${f.key}`}>
                {lang === "ar" ? f.ar : f.en}
              </label>
              <input id={`attr_${f.key}`} name={`attr_${f.key}`} type={f.type} defaultValue={initial.attributes[f.key] ?? ""} className={field} />
            </div>
          ))}
        </div>
      )}

      {!simplified && (
        <>
          <div className="rounded-xl border border-border/70 p-4">
            <div className="flex items-center justify-between">
              <span className={label}>{p.variantsTitle}</span>
              <button
                type="button"
                onClick={() => setVariants([...variants, { label: "", price: "", stock: "" }])}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-surface-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                {p.addVariant}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input value={v.label} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={p.variantLabelPlaceholder} className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <input value={v.price} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} type="number" min="0" step="0.01" placeholder={p.variantPrice} className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <input value={v.stock} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)))} type="number" min="0" step="1" placeholder={p.variantStock} className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <button type="button" onClick={() => setVariants(variants.filter((_, j) => j !== i))} aria-label={p.remove} className="flex w-9 shrink-0 items-center justify-center rounded-lg border border-border text-red-600 transition-colors hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <div className="flex items-center justify-between">
              <span className={label}>{p.addonsTitle}</span>
              <button
                type="button"
                onClick={() => setOptions([...options, { name: "", price: "" }])}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-surface-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                {p.addAddon}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input value={o.name} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder={p.addonNamePlaceholder} className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <input value={o.price} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} type="number" min="0" step="0.01" placeholder={p.addonPrice} className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label={p.remove} className="flex w-9 shrink-0 items-center justify-center rounded-lg border border-border text-red-600 transition-colors hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {loading ? p.saving : p.update}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${lang}/merchant/${storeId}`)}
          className="rounded-xl border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-surface-muted"
        >
          {dict.store.back}
        </button>
      </div>
    </form>
  );
}
