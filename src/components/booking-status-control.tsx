"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUSES = [
  "pending",
  "accepted",
  "scheduled",
  "completed",
  "cancelled",
  "rejected",
] as const;

export function BookingStatusControl({
  bookingId,
  status,
  labels,
}: {
  bookingId: string;
  status: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setValue(next);
    setBusy(true);
    await createClient()
      .from("bookings")
      .update({ status: next })
      .eq("id", bookingId);
    setBusy(false);
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
