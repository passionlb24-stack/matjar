"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

export type CraftService = {
  id: string;
  name: string;
  description: string | null;
  pricing_type: string;
  price: number | null;
  sort_order: number;
};

const PRICING = ["from", "fixed", "hourly", "per_meter", "quote"] as const;

// What they do and what it costs.
//
// pricing_type is a real choice rather than a formatting detail: a callout is
// fixed, a rewire is quoted after seeing it, tiling is per metre. The price
// input disappears entirely for "quote", because a number there would be a
// promise the tradesman did not make.
export function CraftServicesManager({
  providerId,
  services,
  labels,
}: {
  providerId: string;
  services: CraftService[];
  labels: {
    title: string;
    body: string;
    name: string;
    description: string;
    pricing: string;
    price: string;
    add: string;
    adding: string;
    remove: string;
    needName: string;
    error: string;
    types: Record<string, string>;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [pricing, setPricing] = useState<string>("from");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const needsPrice = pricing !== "quote";

  async function add() {
    if (!name.trim()) {
      notifyError(labels.needName);
      return;
    }
    setBusy(true);
    const { error } = await createClient().from("craft_services").insert({
      provider_id: providerId,
      name: name.trim(),
      description: desc.trim() || null,
      pricing_type: pricing,
      // Explicitly null for quote-only, so nothing downstream can render a 0
      // as if it were the price.
      price: needsPrice && price.trim() !== "" ? Number(price) : null,
      sort_order: services.length + 1,
    });
    setBusy(false);
    if (error) {
      notifyError(labels.error);
      return;
    }
    setName("");
    setDesc("");
    setPrice("");
    router.refresh();
  }

  async function remove(id: string) {
    const { error } = await createClient()
      .from("craft_services")
      .delete()
      .eq("id", id);
    if (error) {
      notifyError(labels.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-bold">{labels.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.body}</p>

      {services.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-semibold">{s.name}</p>
                {s.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {s.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-bold text-primary">
                  {s.pricing_type === "quote"
                    ? labels.types.quote
                    : `${labels.types[s.pricing_type] ?? ""} $${s.price ?? 0}`}
                </span>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  aria-label={labels.remove}
                  className="text-muted-foreground transition-colors hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold">{labels.name}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${fieldClass} mt-1.5`}
          />
        </div>
        <div>
          <label className="text-sm font-semibold">{labels.description}</label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className={`${fieldClass} mt-1.5`}
          />
        </div>
        <div>
          <label className="text-sm font-semibold">{labels.pricing}</label>
          <select
            value={pricing}
            onChange={(e) => setPricing(e.target.value)}
            className={`${fieldClass} mt-1.5`}
          >
            {PRICING.map((p) => (
              <option key={p} value={p}>
                {labels.types[p]}
              </option>
            ))}
          </select>
        </div>
        {needsPrice && (
          <div>
            <label className="text-sm font-semibold">{labels.price}</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className={`${fieldClass} mt-1.5`}
            />
          </div>
        )}
      </div>

      <Button onClick={add} loading={busy} className="mt-4">
        <Plus className="h-4 w-4" />
        {busy ? labels.adding : labels.add}
      </Button>
    </div>
  );
}
