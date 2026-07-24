"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type CourseRow = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  price: number | null;
  duration: string | null;
  schedule: string | null;
  level: string | null;
};

type Draft = {
  name: string;
  name_en: string;
  description: string;
  price: string;
  duration: string;
  schedule: string;
  level: string;
};

const empty: Draft = {
  name: "",
  name_en: "",
  description: "",
  price: "",
  duration: "",
  schedule: "",
  level: "",
};

const labelClass = "text-sm font-semibold";

export function CoursesManager({
  storeId,
  lang,
  dict,
  courses,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  courses: CourseRow[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const t = dict.courses;
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
    const { error } = await supabase.from("store_courses").insert({
      store_id: storeId,
      name: draft.name.trim(),
      name_en: draft.name_en.trim() || null,
      description: draft.description.trim() || null,
      price: draft.price === "" ? null : Number(draft.price),
      duration: draft.duration.trim() || null,
      schedule: draft.schedule.trim() || null,
      level: draft.level.trim() || null,
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
    if (!(await confirm({ message: dict.merchant.products.confirmDelete, confirmLabel: dict.common.confirm, cancelLabel: dict.common.cancel, danger: true }))) return;
    setBusy(true);
    const { error } = await createClient()
      .from("store_courses")
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
        <label className={labelClass}>{t.nameEn}</label>
        <Input
          value={draft.name_en}
          onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <label className={labelClass}>{t.description}</label>
        <Textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
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
          <label className={labelClass}>{t.level}</label>
          <Input
            value={draft.level}
            onChange={(e) => setDraft({ ...draft, level: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t.duration}</label>
        <Input
          value={draft.duration}
          onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
          placeholder={t.durationHint}
          className="mt-1"
        />
      </div>
      <div>
        <label className={labelClass}>{t.schedule}</label>
        <Input
          value={draft.schedule}
          onChange={(e) => setDraft({ ...draft, schedule: e.target.value })}
          placeholder={t.scheduleHint}
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
        {courses.length === 0 && !adding && (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
        {courses.map((c) => {
          const primary = lang === "en" ? c.name_en || c.name : c.name;
          const meta = [
            c.duration,
            c.schedule,
            c.level,
            c.price != null ? String(c.price) : null,
          ].filter((part) => part && part.trim() !== "");
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{primary}</p>
                {meta.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                    {meta.map((part, i) => (
                      <span key={i} className="flex items-center gap-x-1">
                        {i > 0 && <span>·</span>}
                        <span>{part}</span>
                      </span>
                    ))}
                  </div>
                )}
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
