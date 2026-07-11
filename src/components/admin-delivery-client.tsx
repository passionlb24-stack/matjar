"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Truck, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

const field =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";

export type DeliveryCompany = {
  id: string;
  name: string;
  coverage: string | null;
  phone: string | null;
  whatsapp: string | null;
  pricing_note: string | null;
  is_active: boolean;
};

export function AdminDeliveryClient({
  dict,
  companies,
}: {
  dict: Dictionary;
  companies: DeliveryCompany[];
}) {
  const router = useRouter();
  const t = dict.admin.delivery;
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const form = new FormData(el);
    const name = String(form.get("name") ?? "").trim();
    if (!name || busy) return;
    setBusy(true);
    await createClient().from("delivery_companies").insert({
      name,
      coverage: String(form.get("coverage") ?? "").trim() || null,
      phone: String(form.get("phone") ?? "").trim() || null,
      whatsapp: String(form.get("whatsapp") ?? "").trim() || null,
      pricing_note: String(form.get("pricing_note") ?? "").trim() || null,
    });
    setBusy(false);
    el.reset();
    router.refresh();
  }

  async function patch(id: string, p: Record<string, unknown>) {
    setBusy(true);
    await createClient().from("delivery_companies").update(p).eq("id", id);
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t.confirmDelete)) return;
    setBusy(true);
    await createClient().from("delivery_companies").delete().eq("id", id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="py-10">
      <Container className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <Truck className="h-7 w-7 text-primary" />
          {t.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <form
          onSubmit={add}
          className="mt-6 rounded-2xl border border-border bg-surface p-5"
        >
          <h2 className="font-bold">{t.addCompany}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="name" type="text" required placeholder={t.name} className={field} />
            <input name="coverage" type="text" placeholder={t.coverage} className={field} />
            <input name="phone" type="tel" placeholder={t.phone} className={field} />
            <input name="whatsapp" type="tel" placeholder={t.whatsapp} className={field} />
            <input name="pricing_note" type="text" placeholder={t.pricingNote} className={`${field} sm:col-span-2`} />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {t.add}
          </button>
        </form>

        {companies.length ? (
          <div className="mt-6 space-y-3">
            {companies.map((c) => (
              <div
                key={c.id}
                className={`rounded-2xl border border-border bg-surface p-5 ${c.is_active ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{c.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[c.coverage, c.pricing_note].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground" dir="ltr">
                      {[c.phone, c.whatsapp].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={busy}
                      onClick={() => patch(c.id, { is_active: !c.is_active })}
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-muted disabled:opacity-60"
                    >
                      {c.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {c.is_active ? t.hide : t.show}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => remove(c.id)}
                      aria-label={t.delete}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            {t.empty}
          </p>
        )}
      </Container>
    </div>
  );
}
