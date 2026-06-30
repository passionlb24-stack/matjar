"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const label = "text-sm font-semibold";

export function ProductForm({
  storeId,
  dict,
}: {
  storeId: string;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setLoading(true);
    setError(null);
    const form = new FormData(formEl);
    const supabase = createClient();
    const { error } = await supabase.from("products").insert({
      store_id: storeId,
      name: String(form.get("name")),
      price: Number(form.get("price")) || 0,
      description: String(form.get("description")) || null,
    });
    if (error) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    formEl.reset();
    setLoading(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-5"
    >
      <h3 className="font-bold">{dict.merchant.products.add}</h3>
      <div>
        <label className={label} htmlFor="name">
          {dict.merchant.products.name}
        </label>
        <input id="name" name="name" type="text" required placeholder={dict.merchant.products.namePlaceholder} className={field} />
      </div>
      <div>
        <label className={label} htmlFor="price">
          {dict.merchant.products.price}
        </label>
        <input id="price" name="price" type="number" min="0" step="0.01" required placeholder="0" className={field} />
      </div>
      <div>
        <label className={label} htmlFor="description">
          {dict.merchant.products.description}
        </label>
        <textarea id="description" name="description" rows={2} placeholder={dict.merchant.products.descriptionPlaceholder} className={field} />
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {loading ? dict.merchant.products.saving : dict.merchant.products.save}
      </button>
    </form>
  );
}
