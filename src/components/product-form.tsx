"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { CategoryKey } from "@/lib/catalog";
import { categoryAttributes } from "@/lib/attributes";
import { ImageUpload } from "@/components/image-upload";

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const label = "text-sm font-semibold";

type VariantRow = { label: string; price: string; stock: string };
type OptionRow = { name: string; price: string };
export type SectionOption = { id: string; name: string; name_en: string | null };

export function ProductForm({
  storeId,
  lang,
  category,
  dict,
  addKey = "add",
  simplified = false,
  sections = [],
}: {
  storeId: string;
  lang: Locale;
  category: CategoryKey;
  dict: Dictionary;
  addKey?: "add" | "addMenuItem" | "addService" | "addListing";
  simplified?: boolean;
  sections?: SectionOption[];
}) {
  const router = useRouter();
  const p = dict.merchant.products;
  const addLabel = p[addKey] ?? p.add;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [adderKey, setAdderKey] = useState(0);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [sectionId, setSectionId] = useState<string>("");
  const [inOffers, setInOffers] = useState(false);
  const [inClearance, setInClearance] = useState(false);
  const [inMarket, setInMarket] = useState(false);
  const attrFields = categoryAttributes[category] ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setLoading(true);
    setError(null);
    const form = new FormData(formEl);
    const supabase = createClient();
    const attributes: Record<string, string> = {};
    attrFields.forEach((f) => {
      const v = String(form.get(`attr_${f.key}`) ?? "").trim();
      if (v) attributes[f.key] = v;
    });
    const stockRaw = String(form.get("stock") ?? "").trim();

    const { data: product, error: insertError } = await supabase
      .from("products")
      .insert({
        store_id: storeId,
        name: String(form.get("name")),
        name_en: String(form.get("name_en") ?? "").trim() || null,
        price: Number(form.get("price")) || 0,
        discount_price: Number(form.get("discount_price")) || null,
        description: String(form.get("description")) || null,
        description_en: String(form.get("description_en") ?? "").trim() || null,
        image_url: imageUrl,
        gallery,
        stock: stockRaw === "" ? null : Number(stockRaw),
        attributes,
        section_id: sectionId || null,
        in_offers: inOffers,
        in_clearance: inClearance,
      })
      .select("id")
      .single();

    if (insertError || !product) {
      // Server trigger blocks free stores past the product limit.
      setError(
        insertError?.message?.includes("free_product_limit")
          ? dict.os.pro.productLimitBody
          : dict.auth.errorGeneric,
      );
      setLoading(false);
      return;
    }

    const cleanVariants = variants
      .filter((v) => v.label.trim())
      .map((v, i) => ({
        product_id: product.id,
        label: v.label.trim(),
        price: v.price.trim() === "" ? null : Number(v.price),
        stock: v.stock.trim() === "" ? null : Number(v.stock),
        sort_order: i,
      }));
    if (cleanVariants.length) {
      const { error: variantsError } = await supabase
        .from("product_variants")
        .insert(cleanVariants);
      if (variantsError) {
        setError(dict.auth.errorGeneric);
        setLoading(false);
        return;
      }
    }

    const cleanOptions = options
      .filter((o) => o.name.trim())
      .map((o, i) => ({
        product_id: product.id,
        name: o.name.trim(),
        price: o.price.trim() === "" ? 0 : Number(o.price),
        sort_order: i,
      }));
    if (cleanOptions.length) {
      const { error: optionsError } = await supabase
        .from("product_options")
        .insert(cleanOptions);
      if (optionsError) {
        setError(dict.auth.errorGeneric);
        setLoading(false);
        return;
      }
    }

    // Cross-post to سوق الأحد if selected (a pending listing derived from the
    // product; the merchant can refine it later from "My listings").
    if (inMarket) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const priceVal = Number(form.get("price")) || 0;
        const discountVal = Number(form.get("discount_price")) || null;
        await supabase.from("listings").insert({
          seller_id: user.id,
          store_id: storeId,
          title: String(form.get("name")),
          description: String(form.get("description")) || null,
          price: discountVal ?? priceVal,
          images: [imageUrl, ...gallery].filter(Boolean),
          status: "pending",
        });
      }
    }

    formEl.reset();
    setImageUrl(null);
    setGallery([]);
    setVariants([]);
    setOptions([]);
    setSectionId("");
    setInOffers(false);
    setInClearance(false);
    setInMarket(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-5"
    >
      <h3 className="font-bold">{addLabel}</h3>
      <ImageUpload
        folder={storeId}
        value={imageUrl}
        onChange={setImageUrl}
        label={p.image}
      />

      {/* Gallery */}
      <div>
        <span className={label}>{p.gallery}</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {gallery.map((url, i) => (
            <div
              key={url}
              className="relative h-20 w-20 overflow-hidden rounded-xl border border-border"
            >
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
        <label className={label} htmlFor="name">
          {p.name}
        </label>
        <input id="name" name="name" type="text" required placeholder={p.namePlaceholder} className={field} />
      </div>
      {sections.length > 0 && (
        <div>
          <label className={label} htmlFor="section_id">
            {p.section}
          </label>
          <select
            id="section_id"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className={field}
          >
            <option value="">{p.noSection}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {lang === "en" && s.name_en?.trim() ? s.name_en : s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={`grid gap-4 ${simplified ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <div>
          <label className={label} htmlFor="price">
            {p.price}
          </label>
          <input id="price" name="price" type="number" min="0" step="0.01" required placeholder="0" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="discount_price">
            {p.discountPrice}
          </label>
          <input id="discount_price" name="discount_price" type="number" min="0" step="0.01" placeholder="0" className={field} />
        </div>
        {!simplified && (
          <div>
            <label className={label} htmlFor="stock">
              {p.stock}
            </label>
            <input id="stock" name="stock" type="number" min="0" step="1" placeholder="∞" className={field} />
          </div>
        )}
      </div>
      <div>
        <label className={label} htmlFor="description">
          {p.description}
        </label>
        <textarea id="description" name="description" rows={2} placeholder={p.descriptionPlaceholder} className={field} />
      </div>

      {/* Optional English overrides — shown to customers browsing in English. */}
      <div className="rounded-xl border border-border/70 p-4">
        <span className={label}>{p.englishOptional}</span>
        <div className="mt-3 space-y-3">
          <div>
            <label className={label} htmlFor="name_en">
              {p.nameEn}
            </label>
            <input id="name_en" name="name_en" type="text" className={field} />
          </div>
          <div>
            <label className={label} htmlFor="description_en">
              {p.descriptionEn}
            </label>
            <textarea id="description_en" name="description_en" rows={2} className={field} />
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
              <input id={`attr_${f.key}`} name={`attr_${f.key}`} type={f.type} className={field} />
            </div>
          ))}
        </div>
      )}

      {!simplified && (
      <>
      {/* Variants */}
      <div className="rounded-xl border border-border/70 p-4">
        <div className="flex items-center justify-between">
          <span className={label}>{p.variantsTitle}</span>
          <button
            type="button"
            onClick={() =>
              setVariants([...variants, { label: "", price: "", stock: "" }])
            }
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-surface-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            {p.addVariant}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="flex flex-wrap items-stretch gap-2">
              <input
                value={v.label}
                onChange={(e) =>
                  setVariants(variants.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
                placeholder={p.variantLabelPlaceholder}
                className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:w-auto sm:flex-1"
              />
              <input
                value={v.price}
                onChange={(e) =>
                  setVariants(variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))
                }
                type="number"
                min="0"
                step="0.01"
                placeholder={p.variantPrice}
                className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={v.stock}
                onChange={(e) =>
                  setVariants(variants.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)))
                }
                type="number"
                min="0"
                step="1"
                placeholder={p.variantStock}
                className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setVariants(variants.filter((_, j) => j !== i))}
                aria-label={p.remove}
                className="flex w-11 shrink-0 items-center justify-center self-stretch rounded-lg border border-border text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add-ons */}
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
            <div key={i} className="flex flex-wrap items-stretch gap-2">
              <input
                value={o.name}
                onChange={(e) =>
                  setOptions(options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder={p.addonNamePlaceholder}
                className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:w-auto sm:flex-1"
              />
              <input
                value={o.price}
                onChange={(e) =>
                  setOptions(options.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))
                }
                type="number"
                min="0"
                step="0.01"
                placeholder={p.addonPrice}
                className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
                aria-label={p.remove}
                className="flex w-11 shrink-0 items-center justify-center self-stretch rounded-lg border border-border text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* عرض في (distribution channels) */}
      <div className="rounded-xl border border-border/70 p-4">
        <span className={label}>{p.showIn}</span>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary">
            <input type="checkbox" checked disabled className="h-4 w-4 accent-primary" />
            {p.channelStore}
          </span>
          {[
            { on: inMarket, set: setInMarket, txt: p.channelMarket },
            { on: inOffers, set: setInOffers, txt: p.channelOffers },
            { on: inClearance, set: setInClearance, txt: p.channelClearance },
          ].map((c) => (
            <label
              key={c.txt}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${
                c.on ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground"
              }`}
            >
              <input type="checkbox" checked={c.on} onChange={(e) => c.set(e.target.checked)} className="h-4 w-4 accent-primary" />
              {c.txt}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {loading ? p.saving : p.save}
      </button>
    </form>
  );
}
