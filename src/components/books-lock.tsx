"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

// Closing a period.
//
// Expenses, supplier debts and stock movements dated on or before this date stop
// being editable — by staff, by the owner, by anyone short of platform support
// (0252). It is the one property of a real ledger a small shop actually needs:
// the figure you declared in March is still the figure in June.
//
// Only the owner sees this, and it asks before moving, because "closed" that can
// be reopened by whoever is at the counter is not closed.
export function BooksLock({
  storeId,
  lockedUntil,
  labels,
}: {
  storeId: string;
  lockedUntil: string | null;
  labels: {
    title: string;
    body: string;
    current: string;
    none: string;
    save: string;
    saving: string;
    saved: string;
    confirm: string;
    confirmYes: string;
    confirmNo: string;
    error: string;
  };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [value, setValue] = useState(lockedUntil ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    const ok = await confirm({
      message: labels.confirm,
      confirmLabel: labels.confirmYes,
      cancelLabel: labels.confirmNo,
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await createClient()
      .from("stores")
      .update({ books_locked_until: value || null })
      .eq("id", storeId);
    setBusy(false);
    if (error) {
      notifyError(labels.error);
      return;
    }
    notifySuccess(labels.saved);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Lock className="h-5 w-5 text-primary" />
        {labels.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.body}</p>

      <p className="mt-3 text-sm font-semibold">
        {labels.current}:{" "}
        <span className={lockedUntil ? "text-primary" : "text-muted-foreground"}>
          {lockedUntil ?? labels.none}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${fieldClass} max-w-48`}
          dir="ltr"
        />
        <Button onClick={save} loading={busy} variant="outline">
          {busy ? labels.saving : labels.save}
        </Button>
      </div>
    </div>
  );
}
