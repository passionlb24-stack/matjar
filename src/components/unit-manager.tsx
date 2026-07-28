"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, BedDouble } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type UnitRow = {
  id: string;
  name: string;
  unit_type: string | null;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  base_nightly_price: number;
  weekend_price: number | null;
  min_nights: number;
  cleaning_fee: number;
  security_deposit: number;
};

const field = `${fieldClass} mt-1`;

// Merchant unit management for accommodation (0191). Add / list / delete units;
// RLS (units_manage) scopes writes to the store's managers.
export function UnitManager({
  storeId,
  dict,
  initial,
}: {
  storeId: string;
  dict: Dictionary;
  initial: UnitRow[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const t = dict.os.units;
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    setBusy(true);
    const { error } = await createClient()
      .from("accommodation_units")
      .insert({
        store_id: storeId,
        name,
        unit_type: String(form.get("unit_type") ?? "").trim() || null,
        max_guests: Number(form.get("max_guests")) || 2,
        bedrooms: Number(form.get("bedrooms")) || 1,
        bathrooms: Number(form.get("bathrooms")) || 1,
        base_nightly_price: Number(form.get("nightly")) || 0,
        weekend_price: Number(form.get("weekend")) || null,
        min_nights: Number(form.get("min_nights")) || 1,
        cleaning_fee: Number(form.get("cleaning")) || 0,
        security_deposit: Number(form.get("deposit")) || 0,
      });
    setBusy(false);
    if (error) {
      notifyError(dict.auth.errorGeneric);
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        message: t.confirmDelete,
        confirmLabel: dict.common.confirm,
        cancelLabel: dict.common.cancel,
        danger: true,
      }))
    )
      return;
    const { error } = await createClient()
      .from("accommodation_units")
      .delete()
      .eq("id", id);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        {initial.length ? (
          <div className="space-y-3">
            {initial.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
                  <BedDouble className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.max_guests} · {u.bedrooms} · ${u.base_nightly_price}
                    {u.weekend_price ? ` / $${u.weekend_price}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => remove(u.id)}
                  aria-label={t.delete}
                  className="flex w-10 shrink-0 items-center justify-center self-stretch rounded-lg border border-border text-danger transition-colors hover:bg-danger-soft"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
      </div>

      <form
        onSubmit={add}
        className="space-y-3 rounded-2xl border border-border bg-surface p-5"
      >
        <h3 className="font-bold">{t.add}</h3>
        <div>
          <label className="text-sm font-semibold">
            {t.name}
            <input name="name" required className={field} />
          </label>
        </div>
        <div>
          <label className="text-sm font-semibold">
            {t.type}
            <input name="unit_type" className={field} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-sm font-semibold">
            {t.guests}
            <input name="max_guests" type="number" min="1" defaultValue={2} className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.bedrooms}
            <input name="bedrooms" type="number" min="0" defaultValue={1} className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.bathrooms}
            <input name="bathrooms" type="number" min="0" defaultValue={1} className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">
            {t.nightly}
            <input name="nightly" type="number" min="0" step="0.01" className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.weekend}
            <input name="weekend" type="number" min="0" step="0.01" className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.minNights}
            <input name="min_nights" type="number" min="1" defaultValue={1} className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.cleaning}
            <input name="cleaning" type="number" min="0" step="0.01" defaultValue={0} className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.deposit}
            <input name="deposit" type="number" min="0" step="0.01" defaultValue={0} className={field} />
          </label>
        </div>
        <Button type="submit" full loading={busy} leftIcon={<Plus className="h-4 w-4" />}>
          {t.save}
        </Button>
      </form>
    </div>
  );
}
