"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";

// Internal, staff-only note on an order (orders.store_note). Merchants can jot a
// handling reminder ("call before delivery", "gift wrap") that customers never
// see. The write goes straight through RLS — the orders_update policy already
// lets the owner or staff with the 'orders' permission edit their store's rows.
export function OrderNoteEditor({
  orderId,
  note,
  labels,
  errorLabel,
}: {
  orderId: string;
  note: string | null;
  labels: {
    title: string;
    add: string;
    placeholder: string;
    save: string;
    cancel: string;
    saved: string;
  };
  errorLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const next = value.trim();
    setBusy(true);
    const { error } = await createClient()
      .from("orders")
      .update({ store_note: next || null })
      .eq("id", orderId);
    setBusy(false);
    if (error) {
      notifyError(errorLabel);
      return;
    }
    notifySuccess(labels.saved);
    setOpen(false);
    router.refresh();
  }

  if (open) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <StickyNote className="h-4 w-4" />
          {labels.title}
        </span>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={labels.placeholder}
          rows={2}
          className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {labels.save}
          </button>
          <button
            onClick={() => {
              setValue(note ?? "");
              setOpen(false);
            }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {labels.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      {note ? (
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold text-foreground">
                {labels.title}:{" "}
              </span>
              {note}
            </span>
          </p>
          <button
            onClick={() => setOpen(true)}
            aria-label={labels.title}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          {labels.add}
        </button>
      )}
    </div>
  );
}
