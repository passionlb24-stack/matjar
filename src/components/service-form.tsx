"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ImageUpload } from "@/components/image-upload";

// Dedicated add-service form for booking sectors (clinics, salons, services…).
// Deliberately different from the product form: no stock/variants/channels —
// a service is a name, a price, a duration, and a booking.
export function ServiceForm({
  storeId,
  dict,
}: {
  storeId: string;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.os.serviceForm;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setLoading(true);
    setError(null);
    setAdded(false);
    const form = new FormData(formEl);
    const duration = String(form.get("duration") ?? "").trim();
    const { error: insertError } = await createClient()
      .from("products")
      .insert({
        store_id: storeId,
        name: String(form.get("name")),
        price: Number(form.get("price")) || 0,
        description: String(form.get("description")) || null,
        image_url: imageUrl,
        attributes: duration ? { duration } : {},
      });
    setLoading(false);
    if (insertError) {
      setError(dict.auth.errorGeneric);
      return;
    }
    formEl.reset();
    setImageUrl(null);
    setAdded(true);
    router.refresh();
  }

  const field =
    "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <form
      onSubmit={onSubmit}
      className="h-fit rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50/60 to-transparent p-5"
    >
      <h2 className="flex items-center gap-2 font-bold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <CalendarCheck className="h-5 w-5" />
        </span>
        {t.title}
      </h2>
      <p className="mt-1.5 text-xs text-muted-foreground">{t.subtitle}</p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-semibold">
          {t.name}
          <input
            name="name"
            required
            placeholder={t.namePlaceholder}
            className={field}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">
            {t.price}
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              className={field}
            />
          </label>
          <label className="block text-sm font-semibold">
            {t.duration}
            <input
              name="duration"
              type="number"
              min="0"
              step="5"
              placeholder={t.durationPlaceholder}
              className={field}
            />
          </label>
        </div>
        <label className="block text-sm font-semibold">
          {t.desc}
          <textarea name="description" rows={2} className={field} />
        </label>
        <ImageUpload
          folder={`services/${storeId}`}
          value={imageUrl}
          onChange={setImageUrl}
          label={t.image}
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {added && (
          <p className="text-sm font-bold text-violet-700">{t.added}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {loading ? t.adding : t.add}
        </button>
      </div>
    </form>
  );
}
