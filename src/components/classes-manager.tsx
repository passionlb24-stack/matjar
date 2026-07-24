"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type ClassRow = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  day_of_week: number;
  start_time: string;
  capacity: number;
  price: number | null;
};

type Draft = {
  name: string;
  name_en: string;
  day_of_week: string;
  start_time: string;
  capacity: string;
  price: string;
  description: string;
};

const empty: Draft = {
  name: "",
  name_en: "",
  day_of_week: "1",
  start_time: "18:00",
  capacity: "10",
  price: "",
  description: "",
};

const labelClass = "text-sm font-semibold";

export function ClassesManager({
  storeId,
  lang,
  dict,
  classes,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  classes: ClassRow[];
}) {
  const router = useRouter();
  const t = dict.classes;
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
    const { error } = await supabase.from("store_classes").insert({
      store_id: storeId,
      name: draft.name.trim(),
      name_en: draft.name_en.trim() || null,
      description: draft.description.trim() || null,
      day_of_week: Number(draft.day_of_week),
      start_time: draft.start_time || "18:00",
      capacity: Number(draft.capacity) || 10,
      price: draft.price === "" ? null : Number(draft.price),
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
      .from("store_classes")
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
          <label className={labelClass}>{t.day}</label>
          <Select
            value={draft.day_of_week}
            onChange={(e) => setDraft({ ...draft, day_of_week: e.target.value })}
            className="mt-1"
          >
            {t.days.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <label className={labelClass}>{t.startTime}</label>
          <Input
            type="time"
            value={draft.start_time}
            onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>{t.capacity}</label>
          <Input
            type="number"
            min={1}
            value={draft.capacity}
            onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
            className="mt-1"
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>{t.price}</label>
          <Input
            type="number"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            className="mt-1"
          />
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
        {classes.length === 0 && !adding && (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
        {classes.map((c) => {
          const primary = lang === "en" ? c.name_en || c.name : c.name;
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground">
                <CalendarClock className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{primary}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                  <span>{t.days[c.day_of_week]}</span>
                  <span>·</span>
                  <span>{c.start_time}</span>
                  <span>·</span>
                  <span>{c.capacity}</span>
                  {c.price != null && <span>·</span>}
                  {c.price != null && <span>{c.price}</span>}
                </div>
                {c.description && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {c.description}
                  </p>
                )}
              </div>
              <button
                disabled={busy}
                onClick={() => remove(c.id)}
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
