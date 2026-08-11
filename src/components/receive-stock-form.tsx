"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

export type ReceivableProduct = { id: string; name: string };
export type SupplierOption = { id: string; name: string };

type Line = {
  product_id: string;
  qty: string;
  pack: string;
  unit_cost: string;
};

// Goods arriving from a supplier, entered once.
//
// This is the step the whole business side was missing: suppliers tracked debts,
// inventory tracked quantities, and products carried a cost price nobody ever
// filled, but nothing connected them — so a delivery had to be typed into three
// screens and was typed into none. One form, one server call, all three or
// nothing (0248).
export function ReceiveStockForm({
  storeId,
  suppliers,
  products,
  labels,
}: {
  storeId: string;
  suppliers: SupplierOption[];
  products: ReceivableProduct[];
  labels: {
    title: string;
    body: string;
    supplier: string;
    noSupplier: string;
    note: string;
    notePlaceholder: string;
    product: string;
    qty: string;
    pack: string;
    unitCost: string;
    units: string;
    addLine: string;
    remove: string;
    total: string;
    submit: string;
    saving: string;
    saved: string;
    needLine: string;
    error: string;
  };
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { product_id: "", qty: "", pack: "1", unit_cost: "" },
  ]);
  const [busy, setBusy] = useState(false);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  // The supplier bills by the thing delivered, so the total is boxes x box
  // price. The pack size only changes how many sellable units that becomes.
  const total = lines.reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0),
    0,
  );
  const units = lines.reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.pack) || 1),
    0,
  );

  async function submit() {
    const payload = lines
      .filter((l) => l.product_id && Number(l.qty) > 0)
      .map((l) => ({
        product_id: l.product_id,
        qty: Number(l.qty),
        pack: Math.max(1, Number(l.pack) || 1),
        // Blank stays null so an unpriced delivery leaves the old cost alone
        // rather than overwriting it with zero.
        unit_cost: l.unit_cost.trim() === "" ? null : Number(l.unit_cost),
      }));
    if (payload.length === 0) {
      notifyError(labels.needLine);
      return;
    }
    setBusy(true);
    const { error } = await createClient().rpc("receive_stock", {
      p_store_id: storeId,
      p_supplier_id: supplierId || null,
      p_lines: payload,
      p_happened_on: null,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      notifyError(labels.error);
      return;
    }
    notifySuccess(labels.saved);
    setLines([{ product_id: "", qty: "", pack: "1", unit_cost: "" }]);
    setNote("");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <PackagePlus className="h-5 w-5 text-primary" />
        {labels.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.body}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold" htmlFor="rs_supplier">
            {labels.supplier}
          </label>
          <select
            id="rs_supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className={`${fieldClass} mt-1.5`}
          >
            {/* A cash run to the market has no account behind it. */}
            <option value="">{labels.noSupplier}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="rs_note">
            {labels.note}
          </label>
          <input
            id="rs_note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={labels.notePlaceholder}
            className={`${fieldClass} mt-1.5`}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1">
              <label className="text-xs font-semibold text-muted-foreground">
                {labels.product}
              </label>
              <select
                value={l.product_id}
                onChange={(e) => setLine(i, { product_id: e.target.value })}
                className={`${fieldClass} mt-1`}
              >
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="text-xs font-semibold text-muted-foreground">
                {labels.qty}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={l.qty}
                onChange={(e) => setLine(i, { qty: e.target.value })}
                className={`${fieldClass} mt-1`}
              />
            </div>
            <div className="w-24">
              <label className="text-xs font-semibold text-muted-foreground">
                {labels.pack}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={l.pack}
                onChange={(e) => setLine(i, { pack: e.target.value })}
                className={`${fieldClass} mt-1`}
              />
            </div>
            <div className="w-28">
              <label className="text-xs font-semibold text-muted-foreground">
                {labels.unitCost}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={l.unit_cost}
                onChange={(e) => setLine(i, { unit_cost: e.target.value })}
                className={`${fieldClass} mt-1`}
              />
            </div>
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLines((prev) => prev.filter((_, n) => n !== i))
                }
                aria-label={labels.remove}
                className="rounded-lg border border-border p-2.5 text-muted-foreground transition-colors hover:border-danger hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setLines((prev) => [
            ...prev,
            { product_id: "", qty: "", pack: "1", unit_cost: "" },
          ])
        }
        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        {labels.addLine}
      </button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-sm font-bold">
          {labels.total}:{" "}
          <span className="tabular-nums text-primary">${total.toFixed(2)}</span>
          {units > 0 && (
            <span className="ms-2 font-semibold text-muted-foreground">
              · {labels.units.replace("{n}", String(units))}
            </span>
          )}
        </span>
        <Button onClick={submit} loading={busy}>
          {busy ? labels.saving : labels.submit}
        </Button>
      </div>
    </div>
  );
}
