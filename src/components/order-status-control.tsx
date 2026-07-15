"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
}: {
  orderId: string;
  status: string;
  labels: Record<string, string>;
  errorLabel?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const prev = value;
    setValue(next);
    setBusy(true);
    const { error } = await createClient()
      .from("orders")
      .update({ status: next })
      .eq("id", orderId);
    setBusy(false);
    if (error) {
      setValue(prev);
      if (errorLabel) window.alert(errorLabel);
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
