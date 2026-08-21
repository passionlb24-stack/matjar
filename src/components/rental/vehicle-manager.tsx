"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Car } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/currency";

export type VehicleRow = {
  id: string;
  name: string;
  vehicle_type: string | null;
  transmission: string | null;
  fuel: string | null;
  seats: number;
  model_year: number | null;
  base_daily_price: number;
  weekend_price: number | null;
  min_days: number;
  delivery_fee: number;
  deposit_amount: number;
  min_driver_age: number;
  daily_km_limit: number | null;
  extra_km_price: number;
  insurance_included: boolean;
  insurance_note: string | null;
  pickup_location: string | null;
};

const field = `${fieldClass} mt-1`;

// Merchant fleet management for the rental engine (0298). Add / list / delete
// vehicles; RLS (rental_vehicles_manage) scopes every write to whoever holds
// the store's `products` permission.
//
// The deposit field carries its own sentence rather than sitting as a bare
// number, because the merchant needs to know what Matjar will and will not do
// with it: display it, and nothing else. There is no payment provider in this
// product — the money is cash, in their hand, at pickup.
export function VehicleManager({
  storeId,
  dict,
  initial,
}: {
  storeId: string;
  dict: Dictionary;
  initial: VehicleRow[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const t = dict.os.vehicles;
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    setBusy(true);
    const { error } = await createClient()
      .from("rental_vehicles")
      .insert({
        store_id: storeId,
        name,
        vehicle_type: String(form.get("vehicle_type") ?? "").trim() || null,
        transmission: String(form.get("transmission") ?? "").trim() || null,
        fuel: String(form.get("fuel") ?? "").trim() || null,
        seats: Number(form.get("seats")) || 5,
        model_year: Number(form.get("model_year")) || null,
        base_daily_price: Number(form.get("daily")) || 0,
        weekend_price: Number(form.get("weekend")) || null,
        min_days: Number(form.get("min_days")) || 1,
        delivery_fee: Number(form.get("delivery")) || 0,
        deposit_amount: Number(form.get("deposit")) || 0,
        min_driver_age: Number(form.get("min_age")) || 18,
        // Empty = unlimited mileage, which is why this is null and not 0: a
        // zero-kilometre allowance is a car nobody may drive.
        daily_km_limit: Number(form.get("km_limit")) || null,
        extra_km_price: Number(form.get("extra_km")) || 0,
        insurance_included: form.get("insurance") === "on",
        insurance_note: String(form.get("insurance_note") ?? "").trim() || null,
        pickup_location: String(form.get("pickup_location") ?? "").trim() || null,
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
      .from("rental_vehicles")
      .delete()
      .eq("id", id);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        {initial.length ? (
          <div className="space-y-3">
            {initial.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
                  <Car className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{v.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span dir="ltr" className="tabular-nums">
                      {formatUsd(v.base_daily_price, { cents: true })}
                      {v.weekend_price
                        ? ` / ${formatUsd(v.weekend_price, { cents: true })}`
                        : ""}
                    </span>
                    {v.deposit_amount > 0 && (
                      <>
                        {" · "}
                        {t.deposit}{" "}
                        <span dir="ltr" className="tabular-nums">
                          {formatUsd(v.deposit_amount, { cents: true })}
                        </span>
                      </>
                    )}
                    {" · "}
                    {t.minAge}{" "}
                    <span dir="ltr" className="tabular-nums">
                      {v.min_driver_age}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => remove(v.id)}
                  aria-label={t.delete}
                  className="flex min-h-11 w-11 shrink-0 items-center justify-center self-stretch rounded-lg border border-border text-danger transition-colors hover:bg-danger-soft"
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
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">
            {t.type}
            <input name="vehicle_type" className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.transmission}
            <input name="transmission" className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.fuel}
            <input name="fuel" className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.seats}
            <input name="seats" type="number" min="1" defaultValue={5} dir="ltr" className={`${field} tabular-nums`} />
          </label>
          <label className="text-sm font-semibold">
            {t.year}
            <input name="model_year" type="number" min="1950" max="2100" dir="ltr" className={`${field} tabular-nums`} />
          </label>
          <label className="text-sm font-semibold">
            {t.minAge}
            <input name="min_age" type="number" min="16" max="99" defaultValue={18} dir="ltr" className={`${field} tabular-nums`} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">
            {t.daily}
            <input name="daily" type="number" min="0" step="0.01" dir="ltr" className={`${field} tabular-nums`} />
          </label>
          <label className="text-sm font-semibold">
            {t.weekend}
            <input name="weekend" type="number" min="0" step="0.01" dir="ltr" className={`${field} tabular-nums`} />
          </label>
          <label className="text-sm font-semibold">
            {t.minDays}
            <input name="min_days" type="number" min="1" defaultValue={1} dir="ltr" className={`${field} tabular-nums`} />
          </label>
          <label className="text-sm font-semibold">
            {t.delivery}
            <input name="delivery" type="number" min="0" step="0.01" defaultValue={0} dir="ltr" className={`${field} tabular-nums`} />
          </label>
        </div>
        <div>
          <label className="text-sm font-semibold">
            {t.deposit}
            <input name="deposit" type="number" min="0" step="0.01" defaultValue={0} dir="ltr" className={`${field} tabular-nums`} />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">{t.depositHint}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">
            {t.kmLimit}
            <input name="km_limit" type="number" min="1" dir="ltr" className={`${field} tabular-nums`} />
          </label>
          <label className="text-sm font-semibold">
            {t.extraKm}
            <input name="extra_km" type="number" min="0" step="0.01" defaultValue={0} dir="ltr" className={`${field} tabular-nums`} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t.kmLimitHint}</p>
        <label className="relative flex items-center gap-2 text-sm font-semibold before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']">
          <input name="insurance" type="checkbox" className="h-4 w-4" />
          {t.insurance}
        </label>
        <div>
          <label className="text-sm font-semibold">
            {t.insuranceNote}
            <input name="insurance_note" className={field} />
          </label>
        </div>
        <div>
          <label className="text-sm font-semibold">
            {t.pickupLocation}
            <input name="pickup_location" className={field} />
          </label>
        </div>
        <Button type="submit" full loading={busy} leftIcon={<Plus className="h-4 w-4" />}>
          {t.save}
        </Button>
      </form>
    </div>
  );
}
