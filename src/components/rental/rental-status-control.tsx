"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { RENTAL_STATUSES } from "@/lib/rental";

// Merchant-side rental status control (update_rental_status RPC, 0298).
//
// The status is not cosmetic: `requested`, `confirmed` and `picked_up` are the
// three values the `rental_no_overlap` exclusion constraint treats as HOLDING
// the car, so moving a booking to `declined` / `cancelled` / `returned` is what
// releases those days back to the fleet. Declining a request is therefore the
// merchant's own release valve, not just a label change.
export function RentalStatusControl({
  rentalId,
  status,
  labels,
  errorLabel,
}: {
  rentalId: string;
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
    const { error } = await createClient().rpc("update_rental_status", {
      p_id: rentalId,
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
      className="min-h-11 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-primary disabled:opacity-60"
    >
      {RENTAL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {labels[s] ?? s}
        </option>
      ))}
    </select>
  );
}
