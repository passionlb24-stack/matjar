"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Package, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export type InventoryProduct = {
  id: string;
  name: string;
  image_url: string | null;
  stock: number | null;
  low_stock_threshold: number;
};

export type Movement = {
  id: string;
  delta: number;
  reason: "sale" | "adjustment" | "purchase" | "return";
  created_at: string;
  products: { name: string } | null;
};

// Inventory module of the Business OS: stock levels at a glance with color
// state (out / low / ok / untracked) and inline absolute-quantity adjustment.
// Every change goes through the adjust_stock RPC so the movement ledger stays
// complete.
export function InventoryManager({
  lang,
  dict,
  products,
  movements,
}: {
  lang: Locale;
  dict: Dictionary;
  products: InventoryProduct[];
  movements: Movement[];
}) {
  const router = useRouter();
  const t = dict.os.inventory;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function save(p: InventoryProduct) {
    const raw = drafts[p.id];
    if (raw == null || raw.trim() === "") return;
    const qty = Math.max(0, Math.floor(Number(raw)));
    if (Number.isNaN(qty)) return;
    setBusy(p.id);
    const { error } = await createClient().rpc("adjust_stock", {
      p_product: p.id,
      p_qty: qty,
    });
    setBusy(null);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    setSavedId(p.id);
    setTimeout(() => setSavedId(null), 1500);
    setDrafts((d) => {
      const { [p.id]: _gone, ...rest } = d;
      void _gone;
      return rest;
    });
    router.refresh();
  }

  const badge = (p: InventoryProduct) => {
    if (p.stock == null)
      return (
        <Badge variant="neutral" size="sm">
          {t.untracked}
        </Badge>
      );
    if (p.stock <= 0)
      return (
        <Badge variant="danger" size="sm">
          {t.out}
        </Badge>
      );
    if (p.stock <= p.low_stock_threshold)
      return (
        <Badge variant="warning" size="sm">
          {t.low} · {p.stock}
        </Badge>
      );
    return (
      <Badge variant="success" size="sm">
        {t.inStock} · {p.stock}
      </Badge>
    );
  };

  const lowOnes = products.filter(
    (p) => p.stock != null && p.stock <= p.low_stock_threshold,
  );

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      month: "short",
      day: "numeric",
    });

  const row = (p: InventoryProduct) => (
    <div
      key={p.id}
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3"
    >
      {p.image_url ? (
        <Image
          src={p.image_url}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-lg object-cover"
          sizes="44px"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
          <Package className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1 font-semibold">{p.name}</span>
      {badge(p)}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={drafts[p.id] ?? ""}
          onChange={(e) =>
            setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
          }
          placeholder={p.stock == null ? t.qty : String(p.stock)}
          className="w-20 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
        <Button
          type="button"
          size="sm"
          loading={busy === p.id}
          disabled={!(drafts[p.id] ?? "").trim()}
          onClick={() => save(p)}
        >
          {savedId === p.id ? <Check className="h-4 w-4" /> : t.save}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      {lowOnes.length > 0 && (
        <section className="rounded-2xl border border-warning/30 bg-warning-soft p-4">
          <h2 className="font-bold text-warning">{t.lowTitle}</h2>
          <div className="mt-3 space-y-2">{lowOnes.map(row)}</div>
        </section>
      )}

      {products.length ? (
        <div className={`space-y-2 ${lowOnes.length ? "mt-6" : ""}`}>
          {products.filter((p) => !lowOnes.includes(p)).map(row)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
          {t.empty}
        </div>
      )}

      {movements.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t.movements}
          </h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
            {movements.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 p-3 text-sm ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span
                  className={`w-12 shrink-0 text-center font-extrabold tabular-nums ${
                    m.delta < 0 ? "text-danger" : "text-success"
                  }`}
                  dir="ltr"
                >
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {m.products?.name ?? "—"}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {t.reasons[m.reason]}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtDate(m.created_at)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
