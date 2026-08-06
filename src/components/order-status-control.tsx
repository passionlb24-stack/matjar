"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/confirm-dialog";

// Moving an order here restores its stock and, once the customer has been told,
// cannot be taken back without confusing them. A native select commits on a
// single change event — a stray scroll wheel over a focused control, or a
// mis-tap in a long list on a phone, was enough to cancel a live order with no
// step in between. These two ask first; every other transition stays instant,
// because a merchant working a lunch rush should not have to confirm "ready".
const DESTRUCTIVE = new Set(["cancelled", "rejected"]);

const STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
  "rejected",
] as const;

export function OrderStatusControl({
  orderId,
  status,
  labels,
  errorLabel,
  confirmLabels,
}: {
  orderId: string;
  status: string;
  labels: Record<string, string>;
  errorLabel?: string;
  /** Omit to keep the old behaviour of committing every change immediately. */
  confirmLabels?: { message: string; confirm: string; cancel: string };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const prev = value;
    if (confirmLabels && DESTRUCTIVE.has(next) && !DESTRUCTIVE.has(prev)) {
      // Show the select snapping back on refusal, rather than leaving it
      // displaying a status the order does not have.
      setValue(next);
      const ok = await confirm({
        message: confirmLabels.message.replace("{status}", labels[next] ?? next),
        confirmLabel: confirmLabels.confirm,
        cancelLabel: confirmLabels.cancel,
        danger: true,
      });
      if (!ok) {
        setValue(prev);
        return;
      }
    }
    setValue(next);
    setBusy(true);
    const { error } = await createClient()
      .from("orders")
      .update({ status: next })
      .eq("id", orderId);
    setBusy(false);
    if (error) {
      setValue(prev);
      if (errorLabel) notifyError(errorLabel);
      return;
    }
    router.refresh();
  }

  return (
    <select
      value={value}
      disabled={busy}
      onChange={onChange}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold outline-none transition-colors focus:border-primary disabled:opacity-60"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {labels[s]}
        </option>
      ))}
    </select>
  );
}
