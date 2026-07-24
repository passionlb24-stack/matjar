"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fieldClass as uiFieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Dictionary } from "@/i18n/get-dictionary";

export type Coupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
};

type Draft = {
  code: string;
  type: "percent" | "fixed";
  value: string;
  min_order: string;
  expires_at: string;
  max_uses: string;
  is_active: boolean;
};

const empty: Draft = {
  code: "",
  type: "percent",
  value: "",
  min_order: "",
  expires_at: "",
  max_uses: "",
  is_active: true,
};

// Shared control styling from the UI library, plus the label gap this form uses.
const fieldClass = `${uiFieldClass} mt-1`;
const labelClass = "text-sm font-semibold";

export function CouponManager({
  storeId,
  dict,
  coupons,
}: {
  storeId: string;
  dict: Dictionary;
  coupons: Coupon[];
}) {
  const router = useRouter();
  const t = dict.merchant.coupons;
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setDraft({ ...empty });
    setEditingId("new");
  }
  function startEdit(c: Coupon) {
    setDraft({
      code: c.code,
      type: c.type,
      value: String(c.value),
      min_order: c.min_order != null ? String(c.min_order) : "",
      expires_at: c.expires_at ? c.expires_at.slice(0, 10) : "",
      max_uses: c.max_uses != null ? String(c.max_uses) : "",
      is_active: c.is_active,
    });
    setEditingId(c.id);
  }
  function cancel() {
    setEditingId(null);
    setDraft(empty);
  }

  async function save() {
    // Percent coupons can't exceed 100% — otherwise the discount RPC
    // (subtotal * value / 100) would refund more than the order total.
    if (draft.type === "percent" && Number(draft.value) > 100) {
      notifyError(dict.auth.errorGeneric);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const payload = {
      store_id: storeId,
      code: draft.code.trim().toUpperCase(),
      type: draft.type,
      value: Number(draft.value) || 0,
      min_order: draft.min_order.trim() === "" ? null : Number(draft.min_order),
      expires_at: draft.expires_at === "" ? null : draft.expires_at,
      max_uses: draft.max_uses.trim() === "" ? null : Number(draft.max_uses),
      is_active: draft.is_active,
    };
    const { error } =
      editingId === "new"
        ? await supabase.from("coupons").insert(payload)
        : await supabase
            .from("coupons")
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq("id", editingId!);
    setBusy(false);
    if (error) {
      notifyError(dict.auth.errorGeneric);
      return;
    }
    cancel();
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(dict.merchant.products.confirmDelete)) return;
    setBusy(true);
    const { error } = await createClient()
      .from("coupons")
      .delete()
      .eq("id", id);
    setBusy(false);
    if (error) {
      notifyError(dict.auth.errorGeneric);
      return;
    }
    router.refresh();
  }

  const form = (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-surface p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t.code}</label>
          <input
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            placeholder={t.codePlaceholder}
            className={`${fieldClass} uppercase`}
          />
        </div>
        <div>
          <label className={labelClass}>{t.type}</label>
          <select
            value={draft.type}
            onChange={(e) =>
              setDraft({ ...draft, type: e.target.value as "percent" | "fixed" })
            }
            className={fieldClass}
          >
            <option value="percent">{t.percent}</option>
            <option value="fixed">{t.fixed}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t.value}</label>
          <input type="number" min="0" step="0.01" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>{t.minOrder}</label>
          <input type="number" min="0" step="0.01" value={draft.min_order} onChange={(e) => setDraft({ ...draft, min_order: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>{t.expires}</label>
          <input type="date" value={draft.expires_at} onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>{t.maxUses}</label>
          <input type="number" min="1" step="1" value={draft.max_uses} onChange={(e) => setDraft({ ...draft, max_uses: e.target.value })} className={fieldClass} />
        </div>
        <label className="flex items-center gap-2 self-end text-sm font-semibold">
          <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-4 w-4 accent-primary" />
          {t.active}
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!draft.code.trim() || !draft.value}
          loading={busy}
          onClick={save}
        >
          {busy ? t.saving : t.save}
        </Button>
        <Button variant="secondary" onClick={cancel} leftIcon={<X className="h-4 w-4" />}>
          {t.cancel}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        {editingId === null && (
          <Button onClick={startNew} className="shrink-0" leftIcon={<Plus className="h-4 w-4" />}>
            {t.add}
          </Button>
        )}
      </div>

      {editingId === "new" && <div className="mt-4">{form}</div>}

      <div className="mt-4 space-y-2">
        {coupons.length === 0 && editingId !== "new" && (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
        {coupons.map((c) =>
          editingId === c.id ? (
            <div key={c.id}>{form}</div>
          ) : (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Ticket className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold">{c.code}</span>
                  <Badge variant="success" size="sm">
                    {c.type === "percent" ? `${c.value}%` : `$${c.value}`}
                  </Badge>
                  {!c.is_active && (
                    <Badge variant="neutral" size="sm">
                      {t.inactiveBadge}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.used_count} {t.used}
                  {c.max_uses != null ? ` / ${c.max_uses}` : ""}
                  {c.expires_at ? ` · ${c.expires_at.slice(0, 10)}` : ""}
                </p>
              </div>
              <button onClick={() => startEdit(c)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted">
                <Pencil className="h-4 w-4" />
              </button>
              <button disabled={busy} onClick={() => remove(c.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-danger transition-colors hover:bg-danger-soft disabled:opacity-60">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
