"use client";

import { useState } from "react";
import { Crown, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";

// A free store owner requests a Pro upgrade for THEIR store (payment is manual).
// This notifies the admins, who activate Pro — no need to re-create a store.
export function RequestProButton({
  storeId,
  requestLabel,
  sentLabel,
}: {
  storeId: string;
  requestLabel: string;
  sentLabel: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");

  async function request() {
    if (state !== "idle") return;
    setState("busy");
    const { error } = await createClient().rpc("request_pro_upgrade", {
      p_store_id: storeId,
    });
    if (error) {
      setState("idle");
      notifyError(error.message ?? "");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <p className="mt-4 flex items-center gap-1.5 text-sm font-bold text-success">
        <Check className="h-4 w-4" />
        {sentLabel}
      </p>
    );
  }

  return (
    <button
      onClick={request}
      disabled={state === "busy"}
      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
    >
      <Crown className="h-4 w-4" />
      {requestLabel}
    </button>
  );
}
