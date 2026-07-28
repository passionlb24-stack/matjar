"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";

const STATUSES = [
  "requested",
  "confirmed",
  "declined",
  "checked_in",
  "checked_out",
  "completed",
  "cancelled",
  "no_show",
] as const;

// Merchant-side stay-booking status control (update_stay_status RPC, 0191).
export function StayStatusControl({
  stayId,
  status,
  labels,
  errorLabel,
}: {
  stayId: string;
  status: string;
  labels: Record<string, string>;
  errorLabel: string;
}) {
  const router = useRouter();
  const [val, setVal] = useState(status);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    const prev = val;
    setVal(next);
    setBusy(true);
    const { error } = await createClient().rpc("update_stay_status", {
      p_id: stayId,
      p_status: next,
    });
    setBusy(false);
    if (error) {
      setVal(prev);
      notifyError(errorLabel);
      return;
    }
    router.refresh();
  }

  return (
    <select
      value={val}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-primary disabled:opacity-60"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {labels[s]}
        </option>
      ))}
    </select>
  );
}
