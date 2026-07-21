"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type Resource = {
  id: string;
  name: string;
  name_en: string | null;
  price: number | null;
  open_hour: number;
  close_hour: number;
};

type Draft = {
  name: string;
  name_en: string;
  price: string;
  open_hour: string;
  close_hour: string;
};

const empty: Draft = {
  name: "",
  name_en: "",
  price: "",
  open_hour: "8",
  close_hour: "24",
};

const labelClass = "text-sm font-semibold";

export function ResourcesManager({
  storeId,
  lang,
  dict,
  resources,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  resources: Resource[];
}) {
  const router = useRouter();
  const t = dict.resources;
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
    const { error } = await supabase.from("store_resources").insert({
      store_id: storeId,
      name: draft.name.trim(),
      name_en: draft.name_en.trim() || null,
      price: draft.price === "" ? null : Number(draft.price),
      open_hour: Number(draft.open_hour) || 8,
      close_hour: Number(draft.close_hour) || 24,
    });
    setBusy(false);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    cancel();
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(dict.merchant.products.confirmDelete)) return;
    setBusy(true);
    const { error } = await createClient()
      .from("store_resources")
      .delete()
      .eq("id", id);
    setBusy(false);
    if (error) {
      window.alert(dict.auth.errorGeneric);
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
      <div>
        <label className={labelClass}>{t.price}</label>
        <Input
          type="number"
          value={draft.price}
          onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          className="mt-1"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>{t.openHour}</label>
          <Input
            type="number"
            min={0}
            max={23}
            value={draft.open_hour}
            onChange={(e) => setDraft({ ...draft, open_hour: e.target.value })}
            className="mt-1"
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>{t.closeHour}</label>
          <Input
            type="number"
            min={1}
            max={24}
            value={draft.close_hour}
            onChange={(e) => setDraft({ ...draft, close_hour: e.target.value })}
            className="mt-1"
          />
        </div>
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
        {resources.length === 0 && !adding && (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
        {resources.map((r) => {
          const primary =
            lang === "en" ? r.name_en || r.name : r.name;
          const secondary =
            lang === "en" ? (r.name_en ? r.name : null) : r.name_en;
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground">
                <CalendarClock className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{primary}</p>
                {secondary && (
                  <p className="truncate text-sm text-muted-foreground">
                    {secondary}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                  {r.price != null && (
                    <span>
                      {t.price}: {r.price}
                    </span>
                  )}
                  <span className="tabular-nums">
                    {r.open_hour}:00 – {r.close_hour}:00
                  </span>
                </div>
              </div>
              <button
                disabled={busy}
                onClick={() => remove(r.id)}
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
