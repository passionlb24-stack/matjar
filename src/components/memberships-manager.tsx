"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type Plan = {
  id: string;
  name: string;
  name_en: string | null;
  price: number | null;
  period: string;
  description: string | null;
};

type Draft = {
  name: string;
  name_en: string;
  price: string;
  period: string;
  description: string;
};

const empty: Draft = {
  name: "",
  name_en: "",
  price: "",
  period: "monthly",
  description: "",
};

const labelClass = "text-sm font-semibold";

const PERIODS = ["monthly", "yearly", "session"] as const;

export function MembershipsManager({
  storeId,
  lang,
  dict,
  plans,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  plans: Plan[];
}) {
  const router = useRouter();
  const t = dict.memberships;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setDraft({ ...empty });
    setAdding(true);
  }
  function cancel() {
    setAdding(false);
    setDraft(empty);
  }

  async function save() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("store_membership_plans").insert({
      store_id: storeId,
      name: draft.name.trim(),
      name_en: draft.name_en.trim() || null,
      price: draft.price === "" ? null : Number(draft.price),
      period: draft.period,
      description: draft.description.trim() || null,
    });
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
      .from("store_membership_plans")
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
      <div>
        <label className={labelClass}>{t.name}</label>
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <label className={labelClass}>{`${t.name} (EN)`}</label>
        <Input
          value={draft.name_en}
          onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
          className="mt-1"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>{t.price}</label>
          <Input
            type="number"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            className="mt-1"
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>{t.period}</label>
          <Select
            value={draft.period}
            onChange={(e) => setDraft({ ...draft, period: e.target.value })}
            className="mt-1"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t.periods[p]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t.description}</label>
        <Textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="mt-1"
        />
      </div>
      <div className="flex gap-2">
        <Button disabled={!draft.name.trim()} loading={busy} onClick={save}>
          {t.save}
        </Button>
        <Button
          variant="secondary"
          onClick={cancel}
          leftIcon={<X className="h-4 w-4" />}
        >
          {dict.merchant.doctors.cancel}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-end">
        {!adding && (
          <Button
            onClick={startNew}
            className="shrink-0"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            {t.add}
          </Button>
        )}
      </div>

      {adding && <div className="mt-4">{form}</div>}

      <div className="mt-4 space-y-2">
        {plans.length === 0 && !adding && (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
        {plans.map((p) => {
          const primary = lang === "en" ? p.name_en || p.name : p.name;
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground">
                <CreditCard className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{primary}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                  {p.price != null && <span>{p.price}</span>}
                  {p.price != null && <span>·</span>}
                  <span>{t.periods[p.period as keyof typeof t.periods]}</span>
                </div>
                {p.description && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {p.description}
                  </p>
                )}
              </div>
              <button
                disabled={busy}
                onClick={() => remove(p.id)}
                aria-label={t.delete}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
