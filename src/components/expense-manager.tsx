"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";

const field =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";

export type Expense = {
  id: string;
  label: string;
  amount: number;
  category: string | null;
  spent_on: string;
};

function money(n: number) {
  return n >= 1000 ? `$${Number(n).toLocaleString("en-US")}` : `$${n}`;
}

export function ExpenseManager({
  storeId,
  dict,
  expenses,
}: {
  storeId: string;
  dict: Dictionary;
  expenses: Expense[];
}) {
  const router = useRouter();
  const t = dict.merchant.accounting;
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const label = String(form.get("label") ?? "").trim();
    const amount = Number(form.get("amount")) || 0;
    if (!label || amount <= 0 || busy) return;
    setBusy(true);
    const spent = String(form.get("spent_on") ?? "").trim();
    await createClient()
      .from("store_expenses")
      .insert({
        store_id: storeId,
        label,
        amount,
        category: String(form.get("category") ?? "").trim() || null,
        ...(spent ? { spent_on: spent } : {}),
      });
    setBusy(false);
    formEl.reset();
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await createClient().from("store_expenses").delete().eq("id", id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={add}
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="font-bold">{t.addExpense}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="label" type="text" required placeholder={t.labelPlaceholder} className={field} />
          <input name="amount" type="number" min="0" step="0.01" required placeholder={t.amountPlaceholder} className={field} />
          <input name="category" type="text" placeholder={t.categoryPlaceholder} className={field} />
          <input name="spent_on" type="date" className={field} />
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

      {expenses.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {expenses.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{x.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {x.spent_on}
                  {x.category ? ` · ${x.category}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-red-600">−{money(Number(x.amount))}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(x.id)}
                  aria-label={t.delete}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {t.noExpenses}
        </p>
      )}
    </div>
  );
}
