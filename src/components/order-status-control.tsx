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
  finalNote,
}: {
  orderId: string;
  status: string;
  labels: Record<string, string>;
  errorLabel?: string;
  /** Omit to keep the old behaviour of committing every change immediately. */
  confirmLabels?: { message: string; confirm: string; cancel: string };
  /** Shown instead of the control once the order is finished. */
  finalNote?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  // Completed is the end of the road (0246). The database refuses to move it,
  // so offering the choice here would only produce an error message — and the
  // damage it used to do was real: stock back for goods already handed over,
  // loyalty points reversed, the sale erased from the day's takings, and the
  // customer's right to review it revoked along with the order.
  if (status === "completed") {
    return (
      <span className="flex flex-col gap-0.5 text-sm">
        <span className="font-semibold">{labels[status] ?? status}</span>
        {finalNote && (
          <span className="text-xs text-muted-foreground">{finalNote}</span>
        )}
      </span>
    );
  }

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
