"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageIcon, Pencil, Trash2, RefreshCw, CircleCheck, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { ListingCard } from "@/lib/data/market";

const STATUSES = ["all", "active", "pending", "sold", "expired", "rejected", "draft"] as const;

const statusStyle: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  sold: "bg-zinc-800 text-white",
  expired: "bg-orange-100 text-orange-700",
  rejected: "bg-red-100 text-red-700",
  draft: "bg-zinc-200 text-zinc-600",
};

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

export function MyListingsManager({
  listings,
  lang,
  dict,
}: {
  listings: ListingCard[];
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.market;
  const [tab, setTab] = useState<(typeof STATUSES)[number]>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = listings.filter((l) => tab === "all" || l.status === tab);

  async function patch(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    await createClient().from("listings").update(patch).eq("id", id);
    setBusy(null);
    router.refresh();
  }
  async function remove(id: string) {
    if (!window.confirm(t.form.confirmDelete)) return;
    setBusy(id);
    await createClient().from("listings").delete().eq("id", id);
    setBusy(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary/40"
            }`}
          >
            {t.tabs[s]}
          </button>
        ))}
      </div>

      {filtered.length ? (
        <div className="mt-4 space-y-2">
          {filtered.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              {l.image ? (
                <Image src={l.image} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" sizes="56px" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{l.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusStyle[l.status]}`}>
                    {t.statusLabels[l.status as keyof typeof t.statusLabels]}
                  </span>
                </div>
                {l.price != null && (
                  <p className="text-sm text-primary">{formatPrice(l.price)}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <Link href={`/${lang}/market/${l.id}/edit`} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-surface-muted">
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                {l.status === "active" && (
                  <>
                    <button disabled={busy === l.id} onClick={() => patch(l.id, { created_at: new Date().toISOString() })} title={t.form.renew} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-surface-muted disabled:opacity-60">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button disabled={busy === l.id} onClick={() => patch(l.id, { status: "sold" })} title={t.form.markSold} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-surface-muted disabled:opacity-60">
                      <CircleCheck className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {(l.status === "sold" || l.status === "expired") && (
                  <button disabled={busy === l.id} onClick={() => patch(l.id, { status: "active", created_at: new Date().toISOString() })} title={l.status === "expired" ? t.form.renew : t.form.markActive} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-surface-muted disabled:opacity-60">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button disabled={busy === l.id} onClick={() => remove(l.id)} className="flex h-8 items-center rounded-lg border border-border px-2.5 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
          {t.myListingsEmpty}
        </div>
      )}
    </div>
  );
}
