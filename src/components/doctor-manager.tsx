"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ImageUpload } from "@/components/image-upload";
import { fieldClass as uiFieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type Doctor = {
  id: string;
  name: string;
  specialty: string | null;
  photo_url: string | null;
  bio: string | null;
};

type Draft = { name: string; specialty: string; photo_url: string | null; bio: string };

const empty: Draft = { name: "", specialty: "", photo_url: null, bio: "" };
// Shared control styling from the UI library, plus the label gap this form uses.
const fieldClass = `${uiFieldClass} mt-1`;
const labelClass = "text-sm font-semibold";

export function DoctorManager({
  storeId,
  dict,
  doctors,
}: {
  storeId: string;
  dict: Dictionary;
  doctors: Doctor[];
}) {
  const router = useRouter();
  const t = dict.merchant.doctors;
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setDraft({ ...empty });
    setEditingId("new");
  }
  function startEdit(d: Doctor) {
    setDraft({
      name: d.name,
      specialty: d.specialty ?? "",
      photo_url: d.photo_url,
      bio: d.bio ?? "",
    });
    setEditingId(d.id);
  }
  function cancel() {
    setEditingId(null);
    setDraft(empty);
  }

  async function save() {
    setBusy(true);
    const supabase = createClient();
    const payload = {
      store_id: storeId,
      name: draft.name.trim(),
      specialty: draft.specialty.trim() || null,
      photo_url: draft.photo_url,
      bio: draft.bio.trim() || null,
    };
    const { error } =
      editingId === "new"
        ? await supabase.from("doctors").insert(payload)
        : await supabase
            .from("doctors")
            .update({ ...payload, updated_at: new Date().toISOString() })
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
    if (!window.confirm(dict.merchant.products.confirmDelete)) return;
    setBusy(true);
    const { error } = await createClient()
      .from("doctors")
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
      <ImageUpload
        folder={storeId}
        value={draft.photo_url}
        onChange={(url) => setDraft({ ...draft, photo_url: url })}
        label={t.photo}
      />
      <div>
        <label className={labelClass}>{t.name}</label>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder={t.namePlaceholder}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>{t.specialty}</label>
        <input
          value={draft.specialty}
          onChange={(e) => setDraft({ ...draft, specialty: e.target.value })}
          placeholder={t.specialtyPlaceholder}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>{t.bio}</label>
        <textarea
          value={draft.bio}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          rows={2}
          placeholder={t.bioPlaceholder}
          className={fieldClass}
        />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!draft.name.trim()}
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
        {doctors.length === 0 && editingId !== "new" && (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
        {doctors.map((d) =>
          editingId === d.id ? (
            <div key={d.id}>{form}</div>
          ) : (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              {d.photo_url ? (
                <Image
                  src={d.photo_url}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                  sizes="48px"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                  <Stethoscope className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{d.name}</p>
                {d.specialty && (
                  <p className="text-sm text-muted-foreground">{d.specialty}</p>
                )}
              </div>
              <button
                onClick={() => startEdit(d)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                disabled={busy}
                onClick={() => remove(d.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
