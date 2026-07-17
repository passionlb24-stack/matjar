"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidateStores } from "@/lib/cache-actions";

export function AdminStoreActions({
  storeId,
  approveLabel,
  rejectLabel,
  confirmRejectLabel,
  errorLabel,
}: {
  storeId: string;
  approveLabel: string;
  rejectLabel: string;
  confirmRejectLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "active" | "rejected") {
    if (status === "rejected" && !window.confirm(confirmRejectLabel)) return;
    setBusy(true);
    const { error } = await createClient()
      .from("stores")
      .update({ status })
      .eq("id", storeId);
    setBusy(false);
    if (error) {
      window.alert(errorLabel);
      return;
    }
    await revalidateStores();
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={busy}
        onClick={() => setStatus("active")}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        <Check className="h-4 w-4" />
        {approveLabel}
      </button>
      <button
        disabled={busy}
        onClick={() => setStatus("rejected")}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
      >
        <X className="h-4 w-4" />
        {rejectLabel}
      </button>
    </div>
  );
}
