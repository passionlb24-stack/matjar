"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";

const STATUSES = [
  "new",
  "contacted",
  "scheduled",
  "negotiating",
  "won",
  "lost",
] as const;

// Merchant-side lead status control. Moves a lead through its workflow via the
// update_lead_status RPC (migration 0190). Optimistic with rollback on error.
export function LeadStatusControl({
  leadId,
  status,
  labels,
  errorLabel,
}: {
  leadId: string;
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
    const { error } = await createClient().rpc("update_lead_status", {
      p_lead_id: leadId,
      p_status: next,
      p_assigned_to: null,
      p_note: null,
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
