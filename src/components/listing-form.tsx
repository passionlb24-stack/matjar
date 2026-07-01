"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, ArrowLeft, ArrowRight, Star, Send, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";
import type { MarketCategory, MarketCity } from "@/lib/data/market";
import { ImageUpload } from "@/components/image-upload";

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const label = "text-sm font-semibold";

export type ListingInitial = {
  title: string;
  description: string;
  price: string;
  categoryId: string;
  city: string;
  region: string;
  images: string[];
  status: string;
};

export function ListingForm({
  lang,
  dict,
  categories,
  cities,
  storeId,
  initial,
  listingId,
}: {
  lang: Locale;
  dict: Dictionary;
  categories: MarketCategory[];
  cities: MarketCity[];
  storeId: string | null;
  initial?: ListingInitial;
  listingId?: string;
}) {
  const router = useRouter();
  const t = dict.market.form;
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [adderKey, setAdderKey] = useState(0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    setImages(next);
  }
  function makeMain(i: number) {
    if (i === 0) return;
    const next = [...images];
    const [pick] = next.splice(i, 1);
    next.unshift(pick);
    setImages(next);
  }

  async function submit(status: "draft" | "pending") {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/${lang}/login`);
      return;
    }
    const payload = {
      seller_id: user.id,
      store_id: storeId,
      category_id: categoryId || null,
      title: title.trim(),
      description: description.trim() || null,
      price: price.trim() === "" ? null : Number(price),
      city: city.trim() || null,
      region: region || null,
      images,
      status,
    };

    if (listingId) {
      const { error: e } = await supabase
        .from("listings")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", listingId);
      if (e) {
        setError(dict.auth.errorGeneric);
        setBusy(false);
        return;
      }
      router.push(`/${lang}/account`);
    } else {
      const { data, error: e } = await supabase
        .from("listings")
        .insert(payload)
        .select("id")
        .single();
      if (e || !data) {
        setError(dict.auth.errorGeneric);
        setBusy(false);
        return;
      }
      router.push(`/${lang}/account`);
    }
    router.refresh();
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      {/* Images */}
      <div>
        <span className={label}>{t.images}</span>
        <p className="text-xs text-muted-foreground">{t.imagesHint}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div
              key={url}
              className="relative h-24 w-24 overflow-hidden rounded-xl border border-border"
            >
              <Image src={url} alt="" fill className="object-cover" sizes="96px" />
              {i === 0 && (
                <span className="absolute start-1 top-1 rounded bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  ★
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-black/40 py-0.5">
                <button type="button" onClick={() => move(i, -1)} className="text-white"><ArrowLeft className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => makeMain(i)} title={t.makeMain} className="text-white"><Star className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} className="text-white"><ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
              <button
                type="button"
                onClick={() => setImages(images.filter((_, j) => j !== i))}
                className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="w-24">
            <ImageUpload
              key={adderKey}
              folder="listings"
              value={null}
              label=""
              onChange={(url) => {
                if (url) {
                  setImages((g) => [...g, url]);
                  setAdderKey((k) => k + 1);
                }
              }}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="title">{t.title}</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePlaceholder} className={field} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="price">{t.price}</label>
          <input id="price" value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="0" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="category">{t.category}</label>
          <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
            <option value="">{t.selectCategory}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="region">{t.region}</label>
          <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} className={field}>
            <option value="">{t.selectRegion}</option>
            {regions.map((r) => (
              <option key={r.key} value={r.key}>{r.name[lang]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="city">{t.city}</label>
          <input
            id="city"
            list="market-cities"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={field}
          />
          <datalist id="market-cities">
            {cities
              .filter((c) => !region || c.region === region)
              .map((c) => (
                <option key={c.id} value={c.name} />
              ))}
          </datalist>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="description">{t.description}</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={t.descriptionPlaceholder} className={field} />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() => submit("pending")}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {busy ? t.saving : listingId ? t.update : t.publish}
        </button>
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() => submit("draft")}
          className="flex items-center gap-1.5 rounded-xl border border-border px-6 py-3 text-sm font-bold transition-colors hover:bg-surface-muted disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {t.saveDraft}
        </button>
      </div>
    </div>
  );
}
