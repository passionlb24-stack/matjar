"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";

// Self-serve 14-day Pro trial. The owner activates their own trial instantly
// (start_pro_trial, 0200) — no admin step; the countdown starts immediately.
export function StartTrialButton({
  storeId,
  label,
  busyLabel,
  errorLabel,
}: {
  storeId: string;
  label: string;
  busyLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    const { error } = await createClient().rpc("start_pro_trial", {
      p_store_id: storeId,
    });
    if (error) {
      setBusy(false);
      notifyError(errorLabel);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={start}
      disabled={busy}
      className="mt-3 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
    >
      <Sparkles className="h-4 w-4" />
      {busy ? busyLabel : label}
    </button>
  );
}
