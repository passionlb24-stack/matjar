"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";
import { GIG_CATEGORIES } from "@/lib/gigs";
import { ImageUpload } from "@/components/image-upload";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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

      <Field label={t.gigTitle} htmlFor="title" required>
        <Input id="title" name="title" type="text" required placeholder={t.gigTitlePlaceholder} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.category} htmlFor="category">
          <Select id="category" name="category" defaultValue="">
            <option value="">{t.selectCategory}</option>
            {GIG_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t.categories[c]}</option>
            ))}
          </Select>
        </Field>
        <Field label={t.region} htmlFor="region">
          <Select id="region" name="region" defaultValue="">
            <option value="">{t.selectRegion}</option>
            {regions.map((r) => (
              <option key={r.key} value={r.key}>{r.name[lang]}</option>
            ))}
          </Select>
        </Field>
        <Field label={t.startingPrice} htmlFor="price">
          <Input id="price" name="price" type="number" min="0" step="0.01" placeholder="$" />
        </Field>
        <Field label={t.deliveryDays} htmlFor="delivery_days">
          <Input id="delivery_days" name="delivery_days" type="number" min="1" step="1" />
        </Field>
      </div>
      <Field label={t.description} htmlFor="description" required>
        <Textarea id="description" name="description" rows={5} required placeholder={t.descriptionPlaceholder} />
      </Field>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" loading={loading}>
        {loading ? dict.account.saving : t.publish}
      </Button>
    </form>
  );
}
