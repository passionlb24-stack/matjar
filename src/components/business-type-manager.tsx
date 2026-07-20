"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { Container } from "@/components/ui/container";

export type BusinessType = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
};

type Draft = Omit<BusinessType, "id">;

const empty: Draft = {
  slug: "",
  name_ar: "",
  name_en: "",
  icon: "store",
  sort_order: 0,
  is_active: true,
};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

export function BusinessTypeManager({
  lang,
  dict,
  types,
}: {
  lang: Locale;
  dict: Dictionary;
  types: BusinessType[];
}) {
  const router = useRouter();
  const t = dict.admin.types;
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setDraft({ ...empty, sort_order: types.length });
    setEditingId("new");
  }
  function startEdit(item: BusinessType) {
    const { id: _id, ...rest } = item;
    void _id;
    setDraft(rest);
    setEditingId(item.id);
  }
  function cancel() {
    setEditingId(null);
    setDraft(empty);
  }

  async function save() {
    setBusy(true);
    const supabase = createClient();
    const { error } =
      editingId === "new"
        ? await supabase.from("business_types").insert(draft)
        : await supabase
            .from("business_types")
            .update({ ...draft, updated_at: new Date().toISOString() })
            .eq("id", editingId!);
    setBusy(false);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    cancel();
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t.confirmDelete)) return;
    setBusy(true);
    const { error } = await createClient()
      .from("business_types")
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
    <div className="rounded-2xl border border-primary/30 bg-surface p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          {t.nameAr}
          <input
            className={`${fieldClass} mt-1`}
            value={draft.name_ar}
            onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          {t.nameEn}
          <input
            className={`${fieldClass} mt-1`}
            value={draft.name_en}
            onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          {t.slug}
          <input
            className={`${fieldClass} mt-1`}
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          {t.icon}
          <input
            className={`${fieldClass} mt-1`}
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          {t.sortOrder}
          <input
            type="number"
            className={`${fieldClass} mt-1`}
            value={draft.sort_order}
            onChange={(e) =>
              setDraft({ ...draft, sort_order: Number(e.target.value) })
            }
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          {t.active}
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          disabled={busy || !draft.name_ar || !draft.name_en || !draft.slug}
          onClick={save}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? t.saving : t.save}
        </button>
        <button
          onClick={cancel}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted"
        >
          <X className="h-4 w-4" />
          {t.cancel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="py-10">
      <Container>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
            <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
          </div>
          {editingId === null && (
            <button
              onClick={startNew}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" />
              {t.add}
            </button>
          )}
        </div>

        {editingId === "new" && <div className="mt-6">{form}</div>}

        <div className="mt-6 space-y-2">
          {types.length === 0 && editingId !== "new" && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
              {t.empty}
            </div>
          )}
          {types.map((item) =>
            editingId === item.id ? (
              <div key={item.id}>{form}</div>
            ) : (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">
                      {lang === "ar" ? item.name_ar : item.name_en}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.slug}
                    </span>
                    {!item.is_active && (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-bold text-zinc-600">
                        {t.inactiveBadge}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => startEdit(item)}
                    aria-label={t.edit}
                    title={t.edit}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-muted"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => remove(item.id)}
                    aria-label={t.delete}
                    title={t.delete}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </Container>
    </div>
  );
}
