"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

type Option = { value: string; label: string };

// Shared control styling from the UI library, plus the label gap this form uses.
const field = `${fieldClass} mt-1.5`;
const label = "text-sm font-semibold";

// A URL-friendly slug from the store name (latin/digits only). Arabic-only names
// yield "" — the merchant then just types their own handle. Kept in sync with the
// DB format rule in migration 0115 (a-z0-9-, trimmed).
function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

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
  // Vanity handle, auto-suggested from the name until the merchant edits it.
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

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
        slug: slug.trim().toLowerCase() || null,
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
      // A 23505 can come from the name OR the slug unique index — disambiguate.
      const msg = error?.message ?? "";
      setError(
        msg.includes("stores_slug_unique")
          ? dict.merchant.customLinkTaken
          : msg.includes("slug_reserved")
            ? dict.merchant.customLinkReserved
            : msg.includes("slug_invalid")
              ? dict.merchant.customLinkInvalid
              : error?.code === "23505"
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
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder={dict.merchant.storeNamePlaceholder}
          className={field}
          onChange={(e) => {
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
        />
      </div>

      <div>
        <label className={label} htmlFor="slug">
          {dict.merchant.customLink}
        </label>
        <div className="mt-1.5 flex items-stretch overflow-hidden rounded-xl border border-border bg-surface transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <span
            dir="ltr"
            className="flex select-none items-center whitespace-nowrap border-e border-border bg-surface-muted px-3 text-sm text-muted-foreground"
          >
            matjarlb.com/
          </span>
          <input
            id="slug"
            dir="ltr"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            placeholder="passion"
            maxLength={30}
            className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {dict.merchant.customLinkHint}
        </p>
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

      <Button type="submit" full loading={loading}>
        {loading ? dict.merchant.creating : dict.merchant.create}
      </Button>
    </form>
  );
}
