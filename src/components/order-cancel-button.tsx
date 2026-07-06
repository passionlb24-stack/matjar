"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";

// Customer-facing cancel for a pending order or an open booking. Calls the
// SECURITY DEFINER RPC so only the owner + allowed status can cancel.
export function OrderCancelButton({
  id,
  kind,
  dict,
}: {
  id: string;
  kind: "order" | "booking";
  dict: Dictionary;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm(dict.orders.cancelConfirm)) return;
    setBusy(true);
    setError(null);
    const rpc = kind === "order" ? "cancel_my_order" : "cancel_my_booking";
    const { error: e } = await createClient().rpc(rpc, { p_id: id });
    setBusy(false);
    if (e) {
      setError(dict.auth.errorGeneric);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={cancel}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
      >
        <X className="h-4 w-4" />
        {dict.orders.cancel}
      </button>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
