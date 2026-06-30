"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Crown, RotateCcw } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { Container } from "@/components/ui/container";

export type SubRow = {
  id: string;
  name: string;
  plan: "free" | "pro";
  subId: string | null;
  expiresAt: string | null;
  payments: number;
};

function Row({
  row,
  lang,
  dict,
}: {
  row: SubRow;
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.admin.subs;
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [amount, setAmount] = useState("12");
  const [busy, setBusy] = useState(false);

  const now = Date.now();
  const expiresMs = row.expiresAt ? new Date(row.expiresAt).getTime() : null;
  const isPro = row.plan === "pro";
  const expired = expiresMs != null && expiresMs <= now;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  function changePeriod(p: "monthly" | "yearly") {
    setPeriod(p);
    setAmount(p === "yearly" ? "120" : "12");
  }

  async function activate() {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const base =
      expiresMs && expiresMs > now ? new Date(expiresMs) : new Date();
    const expires = new Date(base);
    if (period === "yearly") expires.setFullYear(expires.getFullYear() + 1);
    else expires.setMonth(expires.getMonth() + 1);

    let subId = row.subId;
    if (subId) {
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          plan: "pro",
          expires_at: expires.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subId);
    } else {
      const { data: created } = await supabase
        .from("subscriptions")
        .insert({
          store_id: row.id,
          plan: "pro",
          status: "active",
          expires_at: expires.toISOString(),
        })
        .select("id")
        .single();
      subId = (created as { id: string } | null)?.id ?? null;
    }
    await supabase.from("payments").insert({
      store_id: row.id,
      subscription_id: subId,
      amount: Number(amount) || 0,
      period,
      method: "manual",
      recorded_by: user?.id ?? null,
    });
    await supabase
      .from("stores")
      .update({ plan: "pro", is_verified: true })
      .eq("id", row.id);
    setBusy(false);
    router.refresh();
  }

  async function downgrade() {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("store_id", row.id)
      .eq("status", "active");
    await supabase.from("stores").update({ plan: "free" }).eq("id", row.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">{row.name}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              isPro ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {isPro ? t.pro : t.free}
          </span>
          {isPro && row.expiresAt && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                expired ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {expired ? t.expired : t.active} · {t.expires} {fmt(row.expiresAt)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {row.payments} {t.payments}
          </span>
        </div>
        {isPro && (
          <button
            disabled={busy}
            onClick={downgrade}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            {t.downgrade}
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <label className="text-sm">
          <span className="font-semibold">{t.period}</span>
          <select
            value={period}
            onChange={(e) =>
              changePeriod(e.target.value as "monthly" | "yearly")
            }
            className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="monthly">{t.monthly}</option>
            <option value="yearly">{t.yearly}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="font-semibold">{t.amount}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <button
          disabled={busy}
          onClick={activate}
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
        >
          <Crown className="h-4 w-4" />
          {busy ? t.saving : t.activate}
        </button>
      </div>
    </div>
  );
}

export function AdminSubsClient({
  lang,
  dict,
  rows,
}: {
  lang: Locale;
  dict: Dictionary;
  rows: SubRow[];
}) {
  const t = dict.admin.subs;
  const [query, setQuery] = useState("");
  const filtered = rows.filter(
    (r) => !query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="py-10">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 sm:max-w-md">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {filtered.length ? (
          <div className="mt-6 space-y-3">
            {filtered.map((r) => (
              <Row key={r.id} row={r} lang={lang} dict={dict} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
      </Container>
    </div>
  );
}
